import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable, Subject, filter, map } from 'rxjs';
import { In, IsNull, MoreThanOrEqual, Not, Repository } from 'typeorm';
import type {
  DirectContact,
  DirectConversationSummary,
  DirectMessage as DirectMessageDto,
  DirectStreamEvent,
  DirectThread,
  QuotedMessage,
  UserRole,
} from '@stopbet/shared-types';
import { User } from '../users/entities/user.entity';
import { Sede } from '../sedes/entities/sede.entity';
import { PsychologistSede } from '../psychologists/entities/psychologist-sede.entity';
import { formasDeSede, formasDeSedesDeUsuario, resolveSedeId } from '../psychologists/sedes-of-user';
import { PushService } from '../push/push.service';
import { DirectConversation } from './entities/direct-conversation.entity';
import { DirectMessage } from './entities/direct-message.entity';
import { DirectMessageReport } from './entities/direct-message-report.entity';
import { UserBlock } from './entities/user-block.entity';
import { SendDirectMessageDto } from './dto/send-direct-message.dto';

/**
 * Quiénes aparecen en el buscador y pueden recibir un mensaje directo.
 *
 * El PO pidió que se pudiera escribir a toda la sede, equipo clínico incluido (30-09), pero la
 * app del equipo clínico todavía no muestra mensajes directos: un paciente que le escribiera a
 * su psicólogo le hablaría a nadie. Cuando exista esa vista, se suman acá.
 */
export const ROLES_CON_MENSAJES: UserRole[] = ['patient', 'sponsor'];

const LARGO_DE_CITA = 120;
const LARGO_DE_VISTA_PREVIA = 80;
const MÁXIMO_DE_CONTACTOS = 50;
const CON_TILDE = 'áéíóúüñ';
const SIN_TILDE = 'aeiouun';
// Igual que el foro: desde un reporte, el mensaje entra a la cola de moderación.
const UMBRAL_DE_REPORTE = 1;

@Injectable()
export class DirectMessagesService {
  constructor(
    @InjectRepository(DirectConversation)
    private readonly conversationRepo: Repository<DirectConversation>,
    @InjectRepository(DirectMessage)
    private readonly messageRepo: Repository<DirectMessage>,
    @InjectRepository(DirectMessageReport)
    private readonly reportRepo: Repository<DirectMessageReport>,
    @InjectRepository(UserBlock)
    private readonly blockRepo: Repository<UserBlock>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Sede)
    private readonly sedeRepo: Repository<Sede>,
    @InjectRepository(PsychologistSede)
    private readonly psychSedeRepo: Repository<PsychologistSede>,
    private readonly pushService: PushService,
  ) {}

  /**
   * En memoria, como el stream del foro: es un aviso de "esto acaba de pasar", lo que importa
   * ya está en la base. Con más de una instancia del backend habría que pasarlo por Redis.
   */
  private readonly eventos$ = new Subject<{ para: string; evento: DirectStreamEvent }>();

  observarUsuario(userId: string): Observable<DirectStreamEvent> {
    return this.eventos$.pipe(
      filter(({ para }) => para === userId),
      map(({ evento }) => evento),
    );
  }

  // ── Lectura ────────────────────────────────────────────────────────────

  async listConversations(meId: string): Promise<DirectConversationSummary[]> {
    const conversaciones = await this.conversationRepo.find({
      where: [
        { userAId: meId, lastMessageAt: Not(IsNull()) },
        { userBId: meId, lastMessageAt: Not(IsNull()) },
      ],
      relations: ['userA', 'userB'],
      order: { lastMessageAt: 'DESC' },
    });
    if (!conversaciones.length) return [];

    const ids = conversaciones.map((c) => c.id);
    const [últimos, noLeídos, bloqueos] = await Promise.all([
      // Una consulta para el último mensaje de todas las conversaciones: pedirlo por fila
      // sería un N+1 en la pantalla que se abre cada vez que se entra a Comunidad.
      this.messageRepo
        .createQueryBuilder('m')
        .distinctOn(['m.conversationId'])
        .where('m.conversationId IN (:...ids)', { ids })
        .orderBy('m.conversationId')
        .addOrderBy('m.createdAt', 'DESC')
        .getMany(),
      this.messageRepo
        .createQueryBuilder('m')
        .innerJoin(DirectConversation, 'c', 'c.id = m.conversationId')
        .select('m.conversationId', 'conversationId')
        .addSelect('COUNT(*)', 'count')
        .where('m.conversationId IN (:...ids)', { ids })
        .andWhere('m.senderId <> :me', { me: meId })
        .andWhere(
          `m.createdAt > COALESCE(CASE WHEN c."userAId" = :me THEN c."userALastReadAt" ELSE c."userBLastReadAt" END, 'epoch'::timestamptz)`,
          { me: meId },
        )
        .groupBy('m.conversationId')
        .getRawMany<{ conversationId: string; count: string }>(),
      this.blockRepo.find({ where: { blockerId: meId } }),
    ]);

    const últimoPor = new Map(últimos.map((m) => [m.conversationId, m]));
    const noLeídosPor = new Map(noLeídos.map((r) => [r.conversationId, Number(r.count)]));
    const bloqueados = new Set(bloqueos.map((b) => b.blockedId));

    return conversaciones.flatMap((c) => {
      const último = últimoPor.get(c.id);
      // Una conversación cuyo único mensaje se borró no tiene nada que mostrar en la lista.
      if (!último) return [];
      const otro = c.userAId === meId ? c.userB : c.userA;
      return [
        {
          id: c.id,
          other: this.contacto(otro),
          lastMessage: {
            body: recortar(último.body, LARGO_DE_VISTA_PREVIA),
            senderId: último.senderId,
            createdAt: último.createdAt.toISOString(),
          },
          unreadCount: noLeídosPor.get(c.id) ?? 0,
          blockedByMe: bloqueados.has(otro.id),
        },
      ];
    });
  }

  /** Las personas de la sede a las que se les puede escribir, filtradas por nombre. */
  async findContacts(meId: string, búsqueda?: string): Promise<DirectContact[]> {
    const yo = await this.userRepo.findOneOrFail({ where: { id: meId } });
    const formas = await this.formasDeMiSede(yo);
    if (!formas.length) return [];

    const bloqueos = await this.blockRepo.find({
      where: [{ blockerId: meId }, { blockedId: meId }],
    });
    const fuera = new Set([meId]);
    for (const b of bloqueos) fuera.add(b.blockerId === meId ? b.blockedId : b.blockerId);

    const qb = this.userRepo
      .createQueryBuilder('u')
      .where('u.sedeId IN (:...formas)', { formas })
      .andWhere('u.role IN (:...roles)', { roles: ROLES_CON_MENSAJES })
      .andWhere("u.accountStatus = 'active'")
      .andWhere('u.id NOT IN (:...fuera)', { fuera: [...fuera] })
      .orderBy('u.firstName', 'ASC')
      .addOrderBy('u.lastName', 'ASC')
      .take(MÁXIMO_DE_CONTACTOS);

    const texto = búsqueda?.trim();
    if (texto) {
      // Sin tildes ni mayúsculas: quien busca «Jose» tiene que encontrar a José. Con
      // `translate` y no con la extensión `unaccent`, que habría que instalar en la base.
      qb.andWhere(
        `translate(lower(u."firstName" || ' ' || u."lastName"), :con, :sin) LIKE :q`,
        { con: CON_TILDE, sin: SIN_TILDE, q: `%${escaparLike(sinTildes(texto))}%` },
      );
    }

    const usuarios = await qb.getMany();
    return usuarios.map((u) => this.contacto(u));
  }

  /** La conversación con una persona, del mensaje más nuevo al más viejo. */
  async getThread(meId: string, otherId: string, page: number, limit: number): Promise<DirectThread> {
    const [yo, otro] = await Promise.all([
      this.userRepo.findOneOrFail({ where: { id: meId } }),
      this.userRepo.findOne({ where: { id: otherId } }),
    ]);
    const conversación = otro ? await this.buscarConversación(meId, otherId) : null;
    // Sin conversación previa, solo se puede abrir con alguien a quien se le podría escribir:
    // si no, esta ruta serviría para averiguar quién es paciente en otra sede.
    if (!otro || (!conversación && !(await this.esContactoPosible(yo, otro)))) {
      throw new NotFoundException('No encontramos a esa persona');
    }

    const bloqueadoPorMí = !!(await this.blockRepo.findOne({
      where: { blockerId: meId, blockedId: otherId },
    }));

    if (!conversación) {
      return {
        other: this.contacto(otro),
        conversationId: null,
        blockedByMe: bloqueadoPorMí,
        data: [],
        total: 0,
        page,
        limit,
      };
    }

    // Lo que uno reportó deja de aparecerle, igual que en el foro (CA5.3).
    const reportados = await this.reportRepo.find({
      where: { reporterId: meId },
      select: ['messageId'],
    });
    const where: Record<string, unknown> = { conversationId: conversación.id };
    if (reportados.length) where['id'] = Not(In(reportados.map((r) => r.messageId)));

    const [mensajes, total] = await this.messageRepo.findAndCount({
      where,
      relations: ['sender', 'replyTo', 'replyTo.sender'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      other: this.contacto(otro),
      conversationId: conversación.id,
      blockedByMe: bloqueadoPorMí,
      data: mensajes.map((m) => this.serializar(m)),
      total,
      page,
      limit,
    };
  }

  // ── Escritura ──────────────────────────────────────────────────────────

  async send(meId: string, otherId: string, dto: SendDirectMessageDto): Promise<DirectMessageDto> {
    if (dto.clientRequestId) {
      const existente = await this.messageRepo.findOne({
        where: { clientRequestId: dto.clientRequestId, senderId: meId },
        relations: ['sender', 'replyTo', 'replyTo.sender'],
      });
      // El reintento tiene que verse igual que si la primera respuesta hubiera llegado.
      if (existente) return this.serializar(existente);
    }

    if (meId === otherId) throw new BadRequestException('No puedes enviarte mensajes a tu propia cuenta');
    const [yo, otro] = await Promise.all([
      this.userRepo.findOneOrFail({ where: { id: meId } }),
      this.userRepo.findOne({ where: { id: otherId } }),
    ]);
    if (!otro || !(await this.esContactoPosible(yo, otro))) {
      throw new NotFoundException('No encontramos a esa persona');
    }
    // El mismo mensaje en las dos direcciones, a propósito: no delata quién bloqueó a quién.
    if (await this.hayBloqueo(meId, otherId)) {
      throw new ForbiddenException('No puedes enviarle mensajes a esta persona');
    }

    const conversación = await this.obtenerOCrearConversación(yo, otro);

    if (dto.replyToId) {
      const citado = await this.messageRepo.findOne({ where: { id: dto.replyToId } });
      // Citar un mensaje de otra conversación sería una forma de leerlo.
      if (!citado || citado.conversationId !== conversación.id) {
        throw new NotFoundException('El mensaje que respondes ya no existe');
      }
    }

    const guardado = await this.messageRepo.save(
      this.messageRepo.create({
        conversationId: conversación.id,
        senderId: meId,
        body: dto.body,
        replyToId: dto.replyToId ?? null,
        clientRequestId: dto.clientRequestId ?? null,
      }),
    );

    const lado = conversación.userAId === meId ? 'userALastReadAt' : 'userBLastReadAt';
    // Lo propio se da por leído: sin esto, escribir dejaba la conversación con no leídos.
    await this.conversationRepo.update(
      { id: conversación.id },
      { lastMessageAt: guardado.createdAt, [lado]: guardado.createdAt },
    );

    const mensaje = await this.messageRepo.findOneOrFail({
      where: { id: guardado.id },
      relations: ['sender', 'replyTo', 'replyTo.sender'],
    });
    const serializado = this.serializar(mensaje);

    this.eventos$.next({ para: otherId, evento: { kind: 'message', message: serializado, otherId: meId } });
    // También a quien escribió: si tiene la app abierta en otro teléfono, el mensaje aparece ahí.
    this.eventos$.next({ para: meId, evento: { kind: 'message', message: serializado, otherId } });

    void this.avisar(otherId, yo);
    return serializado;
  }

  async markRead(meId: string, otherId: string): Promise<{ read: true }> {
    const conversación = await this.buscarConversación(meId, otherId);
    if (conversación) {
      const lado = conversación.userAId === meId ? 'userALastReadAt' : 'userBLastReadAt';
      await this.conversationRepo.update({ id: conversación.id }, { [lado]: new Date() });
    }
    return { read: true };
  }

  async report(meId: string, messageId: string, reason: string): Promise<{ reported: true }> {
    const mensaje = await this.mensajeDeUnaConversaciónMía(meId, messageId);
    if (mensaje.senderId === meId) {
      throw new BadRequestException('No puedes reportar tu propio mensaje');
    }
    const existente = await this.reportRepo.findOne({ where: { messageId, reporterId: meId } });
    if (!existente) {
      await this.reportRepo.save(this.reportRepo.create({ messageId, reporterId: meId, reason }));
      await this.messageRepo.increment({ id: messageId }, 'reportCount', 1);
    }
    return { reported: true };
  }

  /** Borra un mensaje propio, para las dos personas. */
  async deleteOwn(meId: string, messageId: string): Promise<{ deleted: true }> {
    const mensaje = await this.mensajeDeUnaConversaciónMía(meId, messageId);
    if (mensaje.senderId !== meId) {
      throw new ForbiddenException('Solo puedes eliminar tus mensajes');
    }
    await this.borrar(mensaje);
    return { deleted: true };
  }

  async block(meId: string, otherId: string): Promise<{ blocked: true }> {
    if (meId === otherId) throw new BadRequestException('No puedes bloquear tu propia cuenta');
    const otro = await this.userRepo.findOne({ where: { id: otherId } });
    if (!otro) throw new NotFoundException('No encontramos a esa persona');
    await this.blockRepo
      .createQueryBuilder()
      .insert()
      .values({ blockerId: meId, blockedId: otherId })
      .orIgnore()
      .execute();
    return { blocked: true };
  }

  async unblock(meId: string, otherId: string): Promise<{ blocked: false }> {
    await this.blockRepo.delete({ blockerId: meId, blockedId: otherId });
    return { blocked: false };
  }

  // ── Moderación ─────────────────────────────────────────────────────────
  // La llama `CommunityService`: los reportes de mensajes directos entran a la misma cola que
  // los del foro, así la web y la app del equipo clínico los ven sin cambiar nada.

  /** Mensajes reportados, con la misma forma que una publicación reportada del foro. */
  async findFlagged(sede: string | undefined) {
    const qb = this.messageRepo
      .createQueryBuilder('m')
      .innerJoinAndSelect('m.sender', 'sender')
      .innerJoinAndSelect('m.conversation', 'c')
      .where({ reportCount: MoreThanOrEqual(UMBRAL_DE_REPORTE) })
      .orderBy('m.reportCount', 'DESC');
    if (sede) qb.andWhere('c.sede IN (:...formas)', { formas: await formasDeSede(this.sedeRepo, sede) });
    const mensajes = await qb.getMany();
    if (!mensajes.length) return [];

    // Sin identificar a quien reportó, igual que en el foro.
    const reportes = await this.reportRepo.find({
      where: { messageId: In(mensajes.map((m) => m.id)), dismissedAt: IsNull() },
      select: ['messageId', 'reason'],
      order: { createdAt: 'ASC' },
    });
    const motivos = new Map<string, string[]>();
    for (const r of reportes) {
      if (!motivos.has(r.messageId)) motivos.set(r.messageId, []);
      motivos.get(r.messageId)!.push(r.reason);
    }

    return mensajes.map((m) => ({
      id: m.id,
      authorId: m.senderId,
      authorName: nombreDe(m.sender),
      authorRole: m.sender.role,
      type: 'direct_message' as const,
      sede: m.conversation.sede,
      body: m.body,
      reportCount: m.reportCount,
      replyCount: 0,
      reactions: [],
      replyTo: null,
      achievementDays: null,
      createdAt: m.createdAt.toISOString(),
      reportReasons: motivos.get(m.id) ?? [],
    }));
  }

  /** Devuelve null si el id no es de un mensaje directo, para que el foro siga con lo suyo. */
  async dismissReportsAsModerator(messageId: string, moderatorId: string) {
    const mensaje = await this.messageRepo.findOne({ where: { id: messageId } });
    if (!mensaje) return null;
    const resultado = await this.reportRepo.update(
      { messageId, dismissedAt: IsNull() },
      { dismissedAt: new Date(), dismissedBy: moderatorId },
    );
    await this.messageRepo.update({ id: messageId }, { reportCount: 0 });
    return { dismissed: resultado.affected ?? 0 };
  }

  /**
   * Solo mensajes reportados: el equipo clínico no tiene acceso a las conversaciones, y un
   * borrado sin reporte sería una forma de actuar sobre algo que no debería haber visto.
   */
  async deleteAsModerator(messageId: string) {
    const mensaje = await this.messageRepo.findOne({ where: { id: messageId } });
    if (!mensaje) return null;
    if (mensaje.reportCount < UMBRAL_DE_REPORTE) {
      throw new ForbiddenException('Solo se pueden eliminar mensajes directos reportados');
    }
    await this.borrar(mensaje);
    return { deleted: true as const };
  }

  // ── Internos ───────────────────────────────────────────────────────────

  private async borrar(mensaje: DirectMessage) {
    await this.messageRepo.delete(mensaje.id);
    const conversación = await this.conversationRepo.findOneOrFail({
      where: { id: mensaje.conversationId },
    });
    const evento: DirectStreamEvent = {
      kind: 'deleted',
      messageId: mensaje.id,
      conversationId: conversación.id,
    };
    this.eventos$.next({ para: conversación.userAId, evento });
    this.eventos$.next({ para: conversación.userBId, evento });
  }

  private async mensajeDeUnaConversaciónMía(meId: string, messageId: string) {
    const mensaje = await this.messageRepo.findOne({
      where: { id: messageId },
      relations: ['conversation'],
    });
    // 404 también si no es de una conversación propia: un 403 confirmaría que el id existe.
    if (
      !mensaje ||
      (mensaje.conversation.userAId !== meId && mensaje.conversation.userBId !== meId)
    ) {
      throw new NotFoundException('Mensaje no encontrado');
    }
    return mensaje;
  }

  /** Misma sede, rol con mensajes y cuenta activa. */
  private async esContactoPosible(yo: User, otro: User): Promise<boolean> {
    if (yo.id === otro.id) return false;
    if (!ROLES_CON_MENSAJES.includes(otro.role)) return false;
    if (otro.accountStatus !== 'active') return false;
    if (!otro.sedeId) return false;
    const formas = await this.formasDeMiSede(yo);
    return formas.includes(otro.sedeId);
  }

  private async formasDeMiSede(yo: User): Promise<string[]> {
    return [...(await formasDeSedesDeUsuario(this.sedeRepo, this.psychSedeRepo, yo))];
  }

  private async hayBloqueo(a: string, b: string): Promise<boolean> {
    const n = await this.blockRepo.count({
      where: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    });
    return n > 0;
  }

  private buscarConversación(a: string, b: string) {
    const [userAId, userBId] = par(a, b);
    return this.conversationRepo.findOne({ where: { userAId, userBId } });
  }

  private async obtenerOCrearConversación(yo: User, otro: User): Promise<DirectConversation> {
    const [userAId, userBId] = par(yo.id, otro.id);
    const sedeId = await resolveSedeId(this.sedeRepo, yo.sedeId);
    const sede = sedeId
      ? ((await this.sedeRepo.findOne({ where: { id: sedeId } }))?.name ?? yo.sedeId!)
      : yo.sedeId!;
    // `orIgnore` y después leer: si los dos se escriben al mismo tiempo, el índice único deja
    // pasar una sola conversación y los dos mensajes caen en ella.
    await this.conversationRepo
      .createQueryBuilder()
      .insert()
      .values({ userAId, userBId, sede })
      .orIgnore()
      .execute();
    return this.conversationRepo.findOneOrFail({ where: { userAId, userBId } });
  }

  /**
   * Push a quien recibe. **Dice quién escribió, nunca qué**: la pantalla de bloqueo la ve
   * cualquiera, y es la misma regla que el push del foro (decisión del PO del 22-09).
   *
   * No respeta el silencio de la comunidad (`community_mutes`): ese interruptor apaga el aviso
   * del grupo, y un mensaje dirigido a uno no es ruido de grupo. Un fallo de Firebase no
   * puede tumbar el envío, que ya está guardado.
   */
  private async avisar(destinatarioId: string, autor: User): Promise<void> {
    try {
      await this.pushService.enviarAUsuarios(
        [destinatarioId],
        nombreDe(autor),
        'Te envió un mensaje en StopBet',
        'comunidad',
      );
    } catch {
      // Ver arriba.
    }
  }

  private contacto(u: User): DirectContact {
    return { id: u.id, name: nombreDe(u), role: u.role };
  }

  private serializar(m: DirectMessage): DirectMessageDto {
    return {
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      senderName: nombreDe(m.sender),
      senderRole: m.sender.role,
      body: m.body,
      replyTo: citar(m.replyTo),
      createdAt: m.createdAt.toISOString(),
    };
  }
}

function par(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

function nombreDe(u: User | null | undefined): string {
  return u ? `${u.firstName} ${u.lastName}` : 'Alguien';
}

function recortar(texto: string, largo: number): string {
  return texto.length > largo ? `${texto.slice(0, largo).trimEnd()}…` : texto;
}

function citar(original: DirectMessage | null | undefined): QuotedMessage | null {
  if (!original) return null;
  return {
    id: original.id,
    authorName: nombreDe(original.sender),
    body: recortar(original.body, LARGO_DE_CITA),
  };
}

function sinTildes(texto: string): string {
  let r = texto.toLowerCase();
  for (let i = 0; i < CON_TILDE.length; i++) r = r.split(CON_TILDE[i]).join(SIN_TILDE[i]);
  return r;
}

// Un `%` o `_` en el nombre buscado no puede volverse comodín.
function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`);
}
