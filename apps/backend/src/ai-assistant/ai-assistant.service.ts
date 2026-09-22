import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage, AIMessage as LcAIMessage } from '@langchain/core/messages';
import { AiSession } from './entities/ai-session.entity';
import { AiMessage } from './entities/ai-message.entity';
import { AiSessionSummary } from './entities/ai-session-summary.entity';
import { SendMessageDto } from './dto/send-message.dto';
import { getFallbackMessage } from './fallback';
import { DatosAOmitir, sanitizePii } from './sanitizer';
import { User } from '../users/entities/user.entity';
import { FamilyLink } from '../family/entities/family-link.entity';
import { SponsorAssignment } from '../panic/entities/sponsor-assignment.entity';
import { ClinicalRecordsService } from '../clinical-records/clinical-records.service';
import {
  CrisisSignal,
  CrisisSuggestion,
  RiskLevel,
  SendMessageWithRiskResponse,
  StartSessionResponse,
  TechniqueType,
} from '@stopbet/shared-types';
import {
  AJUTER_SYSTEM_PROMPT,
  SUMMARY_EXTRACTION_PROMPT,
} from './prompts/ajuter-system.prompt';

// Número máximo de mensajes previos a incluir en el contexto de Gemini
const MAX_HISTORY = 12;

// Google descontinúa modelos para cuentas nuevas sin avisar: gemini-2.5-flash-lite
// empezó a responder 404 y el asistente caía al mensaje de respaldo en cada mensaje,
// sin que nada lo delatara desde afuera. Al cambiarlo, revisar también el fallback.
const GEMINI_MODEL = 'gemini-3.5-flash-lite';

// Tiempo de inactividad en ms antes de cerrar sesión automáticamente (10 min)
const INACTIVITY_MS = 10 * 60 * 1000;

// Tope de espera del modelo. Pasado el tope se responde con el mensaje de respaldo
// (S.8) en vez de dejar al paciente esperando indefinidamente.
//
// S.2 pide <=5 s, pero gemini-3.5-flash-lite no lo cumple: mediana ~1 s con una cola
// que se pasa de 5 s con frecuencia (medido: 6,5 / 13,3 / 17,1 / 19,4 s). Con el tope
// en 5 s un "hola" caia al respaldo cada pocas interacciones. Se subio a 15 s para
// privilegiar la respuesta real; queda pendiente acordar con el dueno de S.2 si el
// presupuesto se ajusta o si se cambia de modelo.
const LLM_TIMEOUT_MS = 15_000;

// CA2.1: cuántos mensajes del usuario se miran hacia atrás para decidir si el
// riesgo alto es "sostenido" y no un pico aislado.
const RISK_WINDOW = 3;

@Injectable()
export class AiAssistantService {
  private llm: ChatGoogleGenerativeAI | null;

  constructor(
    @InjectRepository(AiSession)
    private readonly sessionRepo: Repository<AiSession>,
    @InjectRepository(AiMessage)
    private readonly messageRepo: Repository<AiMessage>,
    @InjectRepository(AiSessionSummary)
    private readonly summaryRepo: Repository<AiSessionSummary>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(FamilyLink)
    private readonly familyLinkRepo: Repository<FamilyLink>,
    @InjectRepository(SponsorAssignment)
    private readonly sponsorRepo: Repository<SponsorAssignment>,
    private readonly configService: ConfigService,
    private readonly clinicalRecords: ClinicalRecordsService,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    this.llm = apiKey
      ? new ChatGoogleGenerativeAI({ apiKey, model: GEMINI_MODEL, temperature: 0.75, maxOutputTokens: 350, maxRetries: 0 })
      : null;
  }

  // ── Inicio de sesión ────────────────────────────────────────────────────

  async startSession(userId: string): Promise<StartSessionResponse> {
    // Cerrar sesión activa previa si existe (no debería, pero por si acaso)
    await this.sessionRepo.update(
      { userId, status: 'active' },
      { status: 'closed', closedAt: new Date() },
    );

    // Obtener contexto de la sesión anterior (solo resumen, no contenido)
    const lastSummary = await this.summaryRepo.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    const aiVal = (v: string | null | undefined) => (!v || v.toLowerCase() === 'null' || v.trim() === '') ? null : v.trim();
    const hasMeaningfulSummary = lastSummary && (aiVal(lastSummary.mood) || aiVal(lastSummary.trigger) || aiVal(lastSummary.techniqueUsed));
    // Antes esto se le mostraba al paciente tal cual: 'Última sesión: estado "Cansancio",
    // técnica "Mindfulness", detonante "trabajo".' — un registro técnico con comillas, no una
    // frase que alguien le diría a otra persona. El texto se arma en lenguaje natural con lo
    // que exista; los campos vacíos simplemente no aparecen.
    const previousContext = hasMeaningfulSummary
      ? buildPreviousContext(
          aiVal(lastSummary.mood),
          aiVal(lastSummary.trigger),
          aiVal(lastSummary.techniqueUsed),
        )
      : null;

    const session = await this.sessionRepo.save(
      this.sessionRepo.create({
        userId,
        status: 'active',
        previousContext,
        lastActivityAt: new Date(),
      }),
    );

    // HdU13 CA6: los detonantes que el psicólogo anotó en la ficha personalizan la
    // conversación. No entran en `previousContext` a propósito: ese texto se le muestra al
    // paciente, y devolverle lo que su psicólogo escribió sobre él no es lo que pide el CA.
    // Este contexto solo viaja al modelo, saneado.
    const clinicalTriggers = await this.clinicalRecords.getTriggersForAssistant(userId);

    // Generar mensaje de apertura personalizado
    const openingContent = await this.generateOpeningMessage(
      previousContext,
      clinicalTriggers,
      await this.datosParaOmitir(userId),
    );
    const openingMessage = await this.messageRepo.save(
      this.messageRepo.create({
        sessionId: session.id,
        role: 'assistant',
        content: openingContent,
        techniqueTriggered: null,
      }),
    );

    return {
      session: this.mapSession(session),
      messages: [this.mapMessage(openingMessage)],
      previousContext,
    };
  }

  async getActiveSession(userId: string): Promise<StartSessionResponse | null> {
    const session = await this.sessionRepo.findOne({
      where: { userId, status: 'active' },
    });
    if (!session) return null;

    // Auto-cerrar si lleva más de 10 min inactiva
    if (
      session.lastActivityAt &&
      Date.now() - session.lastActivityAt.getTime() > INACTIVITY_MS
    ) {
      await this.closeSession(session.id, userId);
      return null;
    }

    const messages = await this.messageRepo.find({
      where: { sessionId: session.id },
      order: { createdAt: 'ASC' },
    });

    return {
      session: this.mapSession(session),
      messages: messages.map(this.mapMessage),
      previousContext: session.previousContext,
    };
  }

  // ── Envío de mensajes ───────────────────────────────────────────────────

  async sendMessage(
    sessionId: string,
    userId: string,
    dto: SendMessageDto,
  ): Promise<SendMessageWithRiskResponse> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId, userId, status: 'active' },
    });
    if (!session) throw new NotFoundException('Sesión no encontrada o ya cerrada');

    // Detectar técnica según contenido del usuario
    const technique = this.detectTechnique(dto.content);

    // Guardar mensaje del usuario
    const userMsg = await this.messageRepo.save(
      this.messageRepo.create({
        sessionId,
        role: 'user',
        content: dto.content,
        techniqueTriggered: technique,
      }),
    );

    // Cargar historial reciente para contexto
    const history = await this.messageRepo.find({
      where: { sessionId },
      order: { createdAt: 'ASC' },
      take: MAX_HISTORY,
    });

    // Generar respuesta del asistente
    const aiContent = await this.generateResponse(
      history,
      session.previousContext,
      sessionId,
      await this.datosParaOmitir(userId),
      await this.clinicalRecords.getTriggersForAssistant(userId),
    );

    const assistantMsg = await this.messageRepo.save(
      this.messageRepo.create({
        sessionId,
        role: 'assistant',
        content: aiContent,
        techniqueTriggered: null,
      }),
    );

    // Actualizar timestamp de última actividad
    await this.sessionRepo.update(sessionId, { lastActivityAt: new Date() });

    return {
      userMessage: this.mapMessage(userMsg),
      assistantMessage: this.mapMessage(assistantMsg),
      techniqueTriggered: technique,
      crisis: this.buildCrisisSignal(history, dto.content),
    };
  }

  // ── Cierre de sesión y resumen ──────────────────────────────────────────

  async closeSession(sessionId: string, userId: string): Promise<AiSessionSummary> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException('Sesión no encontrada');

    const messages = await this.messageRepo.find({
      where: { sessionId },
      order: { createdAt: 'ASC' },
    });

    const durationMs = session.startedAt
      ? Date.now() - new Date(session.startedAt).getTime()
      : 0;
    const durationMinutes = Math.round(durationMs / 60000);

    const summaryData = await this.extractSummary(
      messages,
      durationMinutes,
      await this.datosParaOmitir(userId),
    );

    const summary = await this.summaryRepo.save(
      this.summaryRepo.create({
        sessionId,
        userId,
        ...summaryData,
        durationMinutes,
      }),
    );

    await this.sessionRepo.update(sessionId, {
      status: 'closed',
      closedAt: new Date(),
    });

    return summary;
  }

  async getSummaries(userId: string): Promise<AiSessionSummary[]> {
    return this.summaryRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 10,
    });
  }

  // ── Generación de texto con Gemini ──────────────────────────────────────

  // El modelo a veces responde con markdown y la app lo muestra crudo: el paciente
  // ve "**botón de pánico**" con asteriscos, en pleno mensaje de crisis.
  //
  // Se quitan SOLO los marcadores dobles. Los asteriscos sueltos no se tocan porque
  // la línea de ayuda chilena es literalmente *4141: limpiarlos a lo bruto borraría
  // el número justo en el mensaje donde más importa.
  private stripMarkdown(text: string): string {
    return text
      .replace(/\*\*(.+?)\*\*/gs, '$1')
      .replace(/__(.+?)__/gs, '$1');
  }

  // @langchain/google-genai 0.1.3 ignora tanto `signal` como `timeout` en invoke: con un
  // abort a los 200 ms la llamada respondió igual a los 1674 ms. Correrla contra un
  // temporizador es lo único que acota lo que espera el paciente. La petición HTTP sigue
  // viva en segundo plano y su respuesta se descarta; al revisar la librería, comprobar
  // si ya propaga la cancelación y volver a AbortSignal.
  private async conTope<T>(promesa: Promise<T>): Promise<T> {
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promesa,
        new Promise<never>((_, rechazar) => {
          temporizador = setTimeout(
            () => rechazar(new Error(`El asistente superó los ${LLM_TIMEOUT_MS} ms`)),
            LLM_TIMEOUT_MS,
          );
        }),
      ]);
    } finally {
      clearTimeout(temporizador);
    }
  }

  private async invokeConTope(
    mensajes: (SystemMessage | HumanMessage | LcAIMessage)[],
  ): Promise<string> {
    const respuesta = await this.conTope(this.llm!.invoke(mensajes));
    return this.stripMarkdown((respuesta.content as string).trim());
  }

  private async generateOpeningMessage(
    previousContext: string | null,
    clinicalTriggers: string | null,
    paciente?: DatosAOmitir,
  ): Promise<string> {
    const systemWithContext = buildSystemPrompt(
      previousContext,
      clinicalTriggers,
      (texto) => sanitizePii(texto, paciente),
    );

    if (!this.llm) return 'Hola, estoy aquí contigo. ¿Cómo te sientes en este momento?';
    try {
      // El saludo también pasa por el LLM, así que también necesita el tope: es la
      // llamada que se demoraba 13-19 s y dejaba en blanco la pantalla a la que
      // aterriza el paciente cuando el pánico escala (CA1.3).
      return await this.invokeConTope([
        new SystemMessage(systemWithContext),
        new HumanMessage('(inicio de sesión — saluda al paciente de manera cálida y breve)'),
      ]);
    } catch {
      return 'Hola, estoy aquí contigo. ¿Cómo te sientes en este momento?';
    }
  }

  // getFallbackMessage es determinista por semilla: la misma sesión ve siempre el
  // mismo mensaje de respaldo, en vez de uno distinto en cada fallo — eso último
  // sugeriría que el sistema está errático justo cuando el paciente necesita calma.
  // S.3: el sanitizador necesita el nombre para poder omitirlo. Se traen solo esos
  // dos campos y nunca la fila completa: el RUT va cifrado en reposo y no hay razon
  // para descifrarlo aca.
  //
  // HdU13 CA6: ademas del paciente van los nombres de quienes lo rodean, porque los
  // detonantes los escribe el psicologo y ahi aparecen terceros.
  private async datosParaOmitir(userId: string): Promise<DatosAOmitir | undefined> {
    const [user, relacionados] = await Promise.all([
      this.userRepo.findOne({
        where: { id: userId },
        select: ['firstName', 'lastName'],
      }),
      this.nombresDeSuEntorno(userId),
    ]);

    if (!user) return relacionados.length ? { relacionados } : undefined;
    return { firstName: user.firstName, lastName: user.lastName, relacionados };
  }

  // Quienes el sistema ya sabe que rodean al paciente: los familiares vinculados y su
  // compañero de viaje. Se omiten tambien los vinculos `pending`: el vinculo espera la
  // aprobacion del psicologo, pero la persona es igual de real, y aca lo que se decide es
  // que sale hacia un modelo de terceros, no quien ve que en el portal.
  //
  // Es una lista corta y concreta. Un tercero que el psicologo nombre y que no este
  // registrado —«su jefe Nelson»— sigue pasando: no hay forma de distinguirlo de un lugar
  // sin romper el detonante. Queda anotado en docs/ASUNCIONES-PENDIENTES.md.
  private async nombresDeSuEntorno(patientId: string): Promise<string[]> {
    const [vinculos, companeros] = await Promise.all([
      this.familyLinkRepo.find({
        where: { patientUserId: patientId },
        select: { familyUserId: true },
      }),
      this.sponsorRepo.find({
        where: { patientId, isActive: true },
        select: { sponsorId: true },
      }),
    ]);

    const ids = [
      ...vinculos.map((v) => v.familyUserId),
      ...companeros.map((c) => c.sponsorId),
    ];
    if (ids.length === 0) return [];

    const personas = await this.userRepo.find({
      where: { id: In(ids) },
      select: ['firstName', 'lastName'],
    });

    return personas.flatMap((p) => [p.firstName, p.lastName]).filter(Boolean);
  }

  private fallbackSeed(sessionId: string): number {
    let seed = 0;
    for (const char of sessionId) seed = (seed + char.charCodeAt(0)) % 1000;
    return seed;
  }

  private async generateResponse(
    history: AiMessage[],
    previousContext: string | null,
    sessionId: string,
    paciente?: DatosAOmitir,
    clinicalTriggers?: string | null,
  ): Promise<string> {
    // S.3: se sanea SOLO lo que sale hacia el LLM. Lo guardado en la base queda
    // intacto a proposito: son las palabras del propio paciente y el psicologo las
    // necesita tal cual para el seguimiento clinico.
    const omitir = (texto: string) => sanitizePii(texto, paciente);

    // El contexto previo es un resumen generado por el modelo, asi que tambien
    // puede arrastrar el nombre desde una sesion anterior.
    const systemWithContext = buildSystemPrompt(
      previousContext,
      clinicalTriggers ?? null,
      omitir,
    );

    const lcMessages = [
      new SystemMessage(systemWithContext),
      ...history.map((m) =>
        m.role === 'user'
          ? new HumanMessage(omitir(m.content))
          : new LcAIMessage(omitir(m.content)),
      ),
    ];

    const fallback = getFallbackMessage(this.fallbackSeed(sessionId));
    if (!this.llm) return fallback;
    try {
      return await this.invokeConTope(lcMessages);
    } catch (err) {
      // S.8: nunca dejar al paciente sin respuesta. El mensaje de respaldo siempre
      // lleva la ruta de escalada visible (botón de pánico, padrino, *4141). Vale
      // igual si el modelo falló o si se pasó del presupuesto de S.2.
      console.error('[AI] generateResponse error:', (err as Error).message);
      return fallback;
    }
  }

  private async extractSummary(
    messages: AiMessage[],
    durationMinutes: number,
    paciente?: DatosAOmitir,
  ): Promise<Partial<AiSessionSummary>> {
    const userContent = sanitizePii(
      messages
        .filter((m) => m.role === 'user')
        .map((m) => m.content)
        .join(' '),
      paciente,
    );

    if (!userContent.trim() || !this.llm) {
      return { mood: null, trigger: null, riskLevel: null, techniqueUsed: null, progressNote: null };
    }

    try {
      // El resumen también pasa por el modelo, así que también necesita el tope:
      // sin él, cerrar la sesión quedaba esperando y el cliente abortaba con un
      // error. Si se pasa, el catch devuelve el resumen vacío y la sesión igual
      // se cierra — el resumen es secundario, cerrar bien no lo es.
      const response = await this.conTope(
        this.llm.invoke([new HumanMessage(SUMMARY_EXTRACTION_PROMPT(userContent))]),
      );
      const text = (response.content as string).trim();
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]) as Record<string, string>;
        return {
          mood: parsed.mood ?? null,
          trigger: parsed.trigger ?? null,
          // Un valor que no reconocemos es tan poco evaluable como un fallo
          riskLevel: (['low', 'medium', 'high'].includes(parsed.riskLevel)
            ? (parsed.riskLevel as RiskLevel)
            : null),
          techniqueUsed: parsed.techniqueUsed ?? null,
          progressNote: parsed.progressNote ?? null,
        };
      }
    } catch {
      // Fallo silencioso — no loguear contenido del mensaje
    }

    return { mood: null, trigger: null, riskLevel: null, techniqueUsed: null, progressNote: 'Sesión completada' };
  }

  // ── Detección de técnica ────────────────────────────────────────────────

  // CA2.1: el riesgo se evaluaba solo al cerrar la sesión, así que nunca llegaba
  // al cliente durante la conversación — justo cuando sirve. Se calcula por
  // mensaje con reglas deterministas: sin llamada extra al LLM y testeable.
  // Los patrones son provisionales hasta el documento de reglas (S.1).
  // Se quitan los acentos antes de comparar: \b de JS no trata a las vocales
  // acentuadas como carácter de palabra ("recaí\b" nunca calza), y además en el
  // celular la gente escribe sin tilde.
  private normalize(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  // Umbrales alineados con docs/reglas-asistente.md §4: lo que decide no es el tema
  // (apuestas, ánimo bajo) sino la presencia de riesgo *inmediato*. Por eso una
  // recaída sola no basta — hablar de haber apostado en el pasado, sin descontrol
  // actual, no debe disparar el protocolo.
  private detectRiskLevel(text: string): RiskLevel {
    const t = this.normalize(text);

    const selfHarm = /\b(matarme|suicid\w*|no quiero vivir|quiero desaparecer|acabar con todo|hacerme dano)\b/.test(t);

    const lossOfControl =
      /\b(no aguanto|no puedo mas|no puedo parar|voy a apostar|voy al casino)\b/.test(t) ||
      /\b(estoy apostando|aposte todo|perdi todo)\b/.test(t);

    // Recaída mencionada, sin decir por sí sola si sigue en curso
    const relapse = /\b(recai\w*|volvi a apostar|ya apost\w*)\b/.test(t);

    // Marcadores de que está pasando ahora, no de un episodio ya cerrado
    const immediate = /\b(ahora|ahorita|hoy|recien|en este momento|justo)\b/.test(t);

    if (selfHarm || lossOfControl || (relapse && immediate)) return 'high';

    if (
      relapse ||
      /\b(ganas de apostar|impulso|tentacion|ansiedad|angustia|desesper\w*)\b/.test(t) ||
      /\b(sol[oa]|soledad|aislad\w*|abandonad\w*|deprimid\w*)\b/.test(t)
    ) {
      return 'medium';
    }
    return 'low';
  }

  private buildCrisisSignal(
    history: AiMessage[],
    currentContent: string,
  ): CrisisSignal | null {
    const riskLevel = this.detectRiskLevel(currentContent);
    if (riskLevel !== 'high') return null;

    // El mensaje actual ya está en history (se guarda antes), así que se cuenta solo
    const previousHigh = history
      .filter((m) => m.role === 'user')
      .slice(-RISK_WINDOW - 1, -1)
      .filter((m) => this.detectRiskLevel(m.content) === 'high').length;

    const suggestions: CrisisSuggestion[] = [
      'panic_button',
      'contact_sponsor',
      'crisis_line',
    ];
    return { riskLevel, sustained: previousHigh > 0, suggestions };
  }

  private detectTechnique(text: string): TechniqueType | null {
    const t = text.toLowerCase();
    if (/\b(apostar|casino|m[aá]quina|slot|tragamoneda|jugar|bet|impulso|ganas de)\b/.test(t)) return 'breathing';
    if (/\b(ansio|ansiedad|angustia|nervios|desesper)\b/.test(t)) return 'breathing';
    if (/\b(sol[oa]|soledad|aislad|abandonad)\b/.test(t)) return 'grounding';
    return null;
  }

  // ── Mappers ─────────────────────────────────────────────────────────────

  private mapSession(s: AiSession) {
    return {
      id: s.id,
      userId: s.userId,
      status: s.status,
      previousContext: s.previousContext,
      startedAt: s.startedAt.toISOString(),
      closedAt: s.closedAt?.toISOString() ?? null,
      lastActivityAt: s.lastActivityAt?.toISOString() ?? null,
    };
  }

  private mapMessage(m: AiMessage) {
    return {
      id: m.id,
      sessionId: m.sessionId,
      role: m.role,
      content: m.content,
      techniqueTriggered: m.techniqueTriggered,
      createdAt: m.createdAt.toISOString(),
    };
  }
}

// Arma el system prompt con los dos contextos que puede haber. Los dos pasan por `omitir`
// (HdU13 CA6 y S.3): el resumen previo lo escribió el modelo y puede arrastrar el nombre, y los
// detonantes los escribió el psicólogo, que bien puede haber anotado «discusiones con su
// hermana Carla». Al modelo no le hace falta el nombre para entender el detonante.
function buildSystemPrompt(
  previousContext: string | null,
  clinicalTriggers: string | null,
  omitir: (texto: string) => string,
): string {
  let prompt = AJUTER_SYSTEM_PROMPT;
  if (clinicalTriggers) {
    prompt += `\n\nDetonantes registrados por su psicólogo: ${omitir(clinicalTriggers)}`;
  }
  if (previousContext) {
    prompt += `\n\nContexto de sesión anterior: ${omitir(previousContext)}`;
  }
  return prompt;
}

/** Convierte el resumen de la sesión anterior en una frase leíble por el paciente. */
function buildPreviousContext(
  mood: string | null,
  trigger: string | null,
  technique: string | null,
): string {
  const lower = (v: string) => (v.charAt(0).toLowerCase() + v.slice(1)).replace(/\.$/, '');
  const partes: string[] = [];

  if (mood) partes.push(`La última vez hablamos de ${lower(mood)}`);
  if (trigger) {
    partes.push(
      partes.length > 0
        ? `, que apareció con ${lower(trigger)}`
        : `La última vez hablamos de lo que te detonó: ${lower(trigger)}`,
    );
  }
  if (technique) {
    partes.push(partes.length > 0 ? ` y probaste ${lower(technique)}` : `La última vez probaste ${lower(technique)}`);
  }

  return `${partes.join('')}.`;
}
