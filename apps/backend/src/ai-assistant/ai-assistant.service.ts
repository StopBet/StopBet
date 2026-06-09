import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage, AIMessage as LcAIMessage } from '@langchain/core/messages';
import { AiSession } from './entities/ai-session.entity';
import { AiMessage } from './entities/ai-message.entity';
import { AiSessionSummary } from './entities/ai-session-summary.entity';
import { SendMessageDto } from './dto/send-message.dto';
import {
  RiskLevel,
  SendMessageResponse,
  StartSessionResponse,
  TechniqueType,
} from '@stopbet/shared-types';
import {
  AJUTER_SYSTEM_PROMPT,
  SUMMARY_EXTRACTION_PROMPT,
} from './prompts/ajuter-system.prompt';

// Número máximo de mensajes previos a incluir en el contexto de Gemini
const MAX_HISTORY = 12;

// Tiempo de inactividad en ms antes de cerrar sesión automáticamente (10 min)
const INACTIVITY_MS = 10 * 60 * 1000;

@Injectable()
export class AiAssistantService {
  private llm: ChatGoogleGenerativeAI;

  constructor(
    @InjectRepository(AiSession)
    private readonly sessionRepo: Repository<AiSession>,
    @InjectRepository(AiMessage)
    private readonly messageRepo: Repository<AiMessage>,
    @InjectRepository(AiSessionSummary)
    private readonly summaryRepo: Repository<AiSessionSummary>,
    private readonly configService: ConfigService,
  ) {
    this.llm = new ChatGoogleGenerativeAI({
      apiKey: this.configService.get<string>('GEMINI_API_KEY') ?? '',
      model: 'gemini-1.5-flash',
      temperature: 0.75,
      maxOutputTokens: 350,
    });
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

    const previousContext = lastSummary
      ? `Última sesión: estado "${lastSummary.mood ?? 'no registrado'}", técnica "${lastSummary.techniqueUsed ?? 'ninguna'}", detonante "${lastSummary.trigger ?? 'no identificado'}".`
      : null;

    const session = await this.sessionRepo.save(
      this.sessionRepo.create({
        userId,
        status: 'active',
        previousContext,
        lastActivityAt: new Date(),
      }),
    );

    // Generar mensaje de apertura personalizado
    const openingContent = await this.generateOpeningMessage(previousContext);
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
  ): Promise<SendMessageResponse> {
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
    const aiContent = await this.generateResponse(history, session.previousContext);

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

    const summaryData = await this.extractSummary(messages, durationMinutes);

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

  private async generateOpeningMessage(previousContext: string | null): Promise<string> {
    const systemWithContext = previousContext
      ? `${AJUTER_SYSTEM_PROMPT}\n\nContexto de sesión anterior: ${previousContext}`
      : AJUTER_SYSTEM_PROMPT;

    try {
      const response = await this.llm.invoke([
        new SystemMessage(systemWithContext),
        new HumanMessage('(inicio de sesión — saluda al paciente de manera cálida y breve)'),
      ]);
      return (response.content as string).trim();
    } catch {
      return 'Hola, estoy aquí contigo. ¿Cómo te sientes en este momento?';
    }
  }

  private async generateResponse(
    history: AiMessage[],
    previousContext: string | null,
  ): Promise<string> {
    const systemWithContext = previousContext
      ? `${AJUTER_SYSTEM_PROMPT}\n\nContexto de sesión anterior: ${previousContext}`
      : AJUTER_SYSTEM_PROMPT;

    const lcMessages = [
      new SystemMessage(systemWithContext),
      ...history.map((m) =>
        m.role === 'user'
          ? new HumanMessage(m.content)
          : new LcAIMessage(m.content),
      ),
    ];

    try {
      const response = await this.llm.invoke(lcMessages);
      return (response.content as string).trim();
    } catch {
      return 'Entiendo cómo te sientes. ¿Puedes contarme un poco más sobre lo que está pasando?';
    }
  }

  private async extractSummary(
    messages: AiMessage[],
    durationMinutes: number,
  ): Promise<Partial<AiSessionSummary>> {
    const userContent = messages
      .filter((m) => m.role === 'user')
      .map((m) => m.content)
      .join(' ');

    if (!userContent.trim()) {
      return { mood: null, trigger: null, riskLevel: 'low', techniqueUsed: null, progressNote: null };
    }

    try {
      const response = await this.llm.invoke([
        new HumanMessage(SUMMARY_EXTRACTION_PROMPT(userContent)),
      ]);
      const text = (response.content as string).trim();
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]) as Record<string, string>;
        return {
          mood: parsed.mood ?? null,
          trigger: parsed.trigger ?? null,
          riskLevel: (['low', 'medium', 'high'].includes(parsed.riskLevel) ? parsed.riskLevel : 'low') as RiskLevel,
          techniqueUsed: parsed.techniqueUsed ?? null,
          progressNote: parsed.progressNote ?? null,
        };
      }
    } catch {
      // Fallo silencioso — no loguear contenido del mensaje
    }

    return { mood: null, trigger: null, riskLevel: 'low', techniqueUsed: null, progressNote: 'Sesión completada' };
  }

  // ── Detección de técnica ────────────────────────────────────────────────

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
