import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable, Subject, filter, map } from 'rxjs';
import { In, IsNull, MoreThanOrEqual, Not, Repository } from 'typeorm';
import {
  CommunityStreamEvent,
  QuotedMessage,
  ReactionEmoji,
  ReactionSummary,
} from '@stopbet/shared-types';
import { CommunityPost } from './entities/community-post.entity';
import { PostReply } from './entities/post-reply.entity';
import { PostReaction } from './entities/post-reaction.entity';
import { PostReport } from './entities/post-report.entity';
import { AttendanceConfirmation } from './entities/attendance-confirmation.entity';
import { User } from '../users/entities/user.entity';
import { Sede } from '../sedes/entities/sede.entity';
import { PsychologistSede } from '../psychologists/entities/psychologist-sede.entity';
import { resolveSedeId, sedeIdsOfPsychologist } from '../psychologists/sedes-of-user';
import { DB_UUID_RE } from '../registration/dto/is-db-uuid.validator';
import { Notification } from '../notifications/entities/notification.entity';
import { CommunityMute } from '../notifications/entities/community-mute.entity';
import { PushService } from '../push/push.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateReplyDto } from './dto/create-reply.dto';

/** Cuánto del mensaje original se muestra en la cita. */
const LARGO_DE_CITA = 120;

// CA3: a partir de 1 reporte una publicación entra a la cola de moderación (demo)
const REPORT_THRESHOLD = 1;

@Injectable()
export class CommunityService {
  constructor(
    @InjectRepository(CommunityPost)
    private readonly postRepo: Repository<CommunityPost>,
    @InjectRepository(PostReply)
    private readonly replyRepo: Repository<PostReply>,
    @InjectRepository(PostReaction)
    private readonly reactionRepo: Repository<PostReaction>,
    @InjectRepository(PostReport)
    private readonly reportRepo: Repository<PostReport>,
    @InjectRepository(AttendanceConfirmation)
    private readonly attendanceRepo: Repository<AttendanceConfirmation>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(CommunityMute)
    private readonly communityMuteRepo: Repository<CommunityMute>,
    @InjectRepository(Sede)
    private readonly sedeRepo: Repository<Sede>,
    @InjectRepository(PsychologistSede)
    private readonly psychSedeRepo: Repository<PsychologistSede>,
    private readonly pushService: PushService,
  ) {}

  /**
   * Lo que se escribe en el foro, en vivo.
   *
   * Vive en memoria a propósito: es un aviso de "esto acaba de pasar", no un registro. Lo
   * que importa ya quedó en la base, así que un reinicio del backend no pierde nada; los
   * clientes reconectan y su primera carga trae lo que se perdieron. Con más de una
   * instancia esto haría falta que pasara por algo compartido, pero hoy hay una sola.
   */
  private readonly eventos$ = new Subject<{ sede: string; evento: CommunityStreamEvent }>();

  /** Los mensajes de una sede, en vivo. Acepta el nombre o el UUID, como las lecturas. */
  async observarSede(sede: string): Promise<Observable<CommunityStreamEvent>> {
    const formas = new Set(await this.formasDeSede(sede));
    return this.eventos$.pipe(
      filter(({ sede: deDónde }) => formas.has(deDónde)),
      map(({ evento }) => evento),
    );
  }

  /**
   * `community_posts.sede` guarda el NOMBRE de la sede, pero `users.sedeId` guarda el nombre
   * o el UUID según de dónde venga la cuenta (seed → 'Santiago'; registro → UUID). Comparar
   * por un solo lado parte el foro de una sede en dos mitades que no se ven entre sí, y el
   * síntoma es una lista vacía, no un error. Mientras no exista la migración que normalice la
   * columna, acá se aceptan las dos formas - es el `mismaSede()` de la app, en el servidor.
   */
  private async formasDeSede(sede: string): Promise<string[]> {
    const fila = DB_UUID_RE.test(sede)
      ? await this.sedeRepo.findOne({ where: { id: sede } })
      : await this.sedeRepo.findOne({ where: { name: sede } });
    return fila ? [fila.id, fila.name] : [sede];
  }

  /** Todas las formas de las sedes que cubre el usuario, para comparar sin falsos negativos. */
  private async sedesDelUsuario(userId: string): Promise<Set<string>> {
    const user = await this.userRepo.findOneOrFail({ where: { id: userId } });
    const ids =
      user.role === 'psychologist' || user.role === 'coordinator'
        ? await sedeIdsOfPsychologist(this.psychSedeRepo, this.sedeRepo, userId, user.sedeId)
        : ([await resolveSedeId(this.sedeRepo, user.sedeId)].filter(Boolean) as string[]);

    const filas = ids.length ? await this.sedeRepo.find({ where: { id: In(ids) } }) : [];
    const formas = new Set<string>();
    // El valor crudo también entra: una sede que no esté en la tabla no debe dejar al usuario
    // fuera de su propio foro.
    if (user.sedeId) formas.add(user.sedeId);
    for (const s of filas) {
      formas.add(s.id);
      formas.add(s.name);
    }
    return formas;
  }

  /** La sede con la que se guarda lo que escribe el usuario. Sale del token, nunca del cliente. */
  private async sedeParaEscribir(userId: string): Promise<string> {
    const user = await this.userRepo.findOneOrFail({ where: { id: userId } });
    const sedeId = await resolveSedeId(this.sedeRepo, user.sedeId);
    const fila = sedeId ? await this.sedeRepo.findOne({ where: { id: sedeId } }) : null;
    if (fila) return fila.name;
    if (user.sedeId) return user.sedeId;
    throw new ForbiddenException('Tu cuenta no tiene una sede asignada');
  }

  private async assertPuedeEscribirEn(userId: string, sedeDelPost: string) {
    const formas = await this.sedesDelUsuario(userId);
    if (!formas.has(sedeDelPost)) {
      throw new ForbiddenException('No puedes escribir en el chat de otra sede');
    }
  }

  async findAnnouncements(sede: string, userId: string) {
    const posts = await this.postRepo.find({
      where: { type: 'announcement', sede: In(await this.formasDeSede(sede)) },
      relations: ['author'],
      order: { createdAt: 'DESC' },
    });

    const postIds = posts.map((p) => p.id);
    const attended = postIds.length
      ? await this.attendanceRepo.find({ where: { postId: In(postIds), userId } })
      : [];
    const attendedSet = new Set(attended.map((a) => a.postId));

    return posts.map((p) => this.serializeAnnouncement(p, attendedSet.has(p.id)));
  }

  async createAnnouncement(dto: CreateAnnouncementDto, authorId: string) {
    await this.assertPuedeEscribirEn(authorId, dto.sede);
    const post = this.postRepo.create({
      authorId,
      type: 'announcement',
      sede: dto.sede,
      title: dto.title ?? null,
      body: dto.body,
      eventDate: dto.eventDate ? new Date(dto.eventDate) : null,
    });
    const saved = await this.postRepo.save(post);
    const author = await this.userRepo.findOneOrFail({ where: { id: authorId } });
    saved.author = author;
    return this.serializeAnnouncement(saved, false);
  }

  async toggleAttendance(postId: string, userId: string) {
    const post = await this.postRepo.findOne({ where: { id: postId, type: 'announcement' } });
    if (!post) throw new NotFoundException('Anuncio no encontrado');

    const existing = await this.attendanceRepo.findOne({ where: { postId, userId } });
    if (existing) {
      await this.attendanceRepo.delete(existing.id);
      return { attends: false };
    }
    await this.attendanceRepo.save(this.attendanceRepo.create({ postId, userId }));
    return { attends: true };
  }

  async findPosts(sede: string, page: number, limit: number, userId: string) {
    const skip = (page - 1) * limit;

    // CA5.3: un post reportado por este usuario deja de aparecerle a él (no a los demás)
    const reportedByUser = await this.reportRepo.find({
      where: { reporterId: userId },
      select: ['postId'],
    });
    const where: Record<string, unknown> = {
      type: 'forum_post',
      sede: In(await this.formasDeSede(sede)),
    };
    if (reportedByUser.length) {
      where['id'] = Not(In(reportedByUser.map((r) => r.postId)));
    }

    const [posts, total] = await this.postRepo.findAndCount({
      where,
      // La cita y su autor viajan en la misma consulta: pedirlas por mensaje sería un N+1
      // en la pantalla que el paciente abre todos los días.
      relations: ['author', 'replyTo', 'replyTo.author'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    if (!posts.length) return { data: [], total, page, limit };

    const postIds = posts.map((p) => p.id);

    const [replyCounts, reactions] = await Promise.all([
      this.replyRepo
        .createQueryBuilder('r')
        .select('r.postId', 'postId')
        .addSelect('COUNT(*)', 'count')
        .where('r.postId IN (:...ids)', { ids: postIds })
        .groupBy('r.postId')
        .getRawMany<{ postId: string; count: string }>(),
      this.reactionRepo.find({ where: { postId: In(postIds) } }),
    ]);

    const replyCountMap = new Map(replyCounts.map((r) => [r.postId, Number(r.count)]));
    const reactionsByPost = this.groupReactionsByPost(reactions);

    return {
      data: posts.map((p) =>
        this.serializePost(
          p,
          reactionsByPost.get(p.id) ?? [],
          replyCountMap.get(p.id) ?? 0,
          userId,
        ),
      ),
      total,
      page,
      limit,
    };
  }

  // El cliente manda `clientRequestId` y lo conserva al reintentar. Sin esto, una
  // respuesta perdida de vuelta dejaba al paciente viendo "sin conexión" con el post
  // ya guardado: al reintentar quedaba publicado dos veces delante de su grupo.
  /**
   * `achievementDays` va aparte y **no** en el DTO a propósito: si viajara en el cuerpo,
   * cualquiera podría publicar un logro de 500 días que nunca cumplió. Solo lo llena
   * `createBadgeAnnouncementPost`, que lo toma de la insignia ya ganada.
   */
  async createPost(
    dto: CreatePostDto,
    authorId: string,
    interno?: { achievementDays?: number },
  ) {
    if (dto.clientRequestId) {
      const existing = await this.postRepo.findOne({
        where: { clientRequestId: dto.clientRequestId },
        relations: ['author', 'replyTo', 'replyTo.author'],
      });
      // Se devuelve la respuesta original en vez de 409: para el cliente el
      // reintento tiene que verse igual que si la primera hubiera llegado.
      if (existing) return this.serializePost(existing, [], 0, authorId);
    }

    // Citar un mensaje de otra sede sería una forma de leerlo: la cita viaja dentro de la
    // respuesta, así que el original tiene que ser de la misma comunidad.
    const sedeDelAutor = await this.sedeParaEscribir(authorId);
    if (dto.replyToId) {
      const citado = await this.postRepo.findOne({ where: { id: dto.replyToId } });
      if (!citado) throw new NotFoundException('El mensaje que respondes ya no existe');
      await this.assertPuedeEscribirEn(authorId, citado.sede);
    }

    const post = await this.postRepo.save(
      this.postRepo.create({
        authorId,
        type: 'forum_post',
        replyToId: dto.replyToId ?? null,
        achievementDays: interno?.achievementDays ?? null,
        // La sede sale de la cuenta, no del cuerpo: `dto.sede` la elegía el cliente, así que
        // cualquier sesión podía publicar en el foro de una sede ajena.
        sede: sedeDelAutor,
        body: dto.body,
        clientRequestId: dto.clientRequestId ?? null,
      }),
    );
    const author = await this.userRepo.findOneOrFail({ where: { id: authorId } });
    post.author = author;
    if (post.replyToId) {
      post.replyTo = await this.postRepo.findOne({
        where: { id: post.replyToId },
        relations: ['author'],
      });
    }
    // Quien recibe la cita se entera, igual que antes cuando respondían su publicación.
    if (post.replyTo) {
      await this.notifyInteraction(post.replyTo, authorId, 'respondió a');
    }

    void this.avisarALaSede(post, author);

    const serializado = this.serializePost(post, [], 0, authorId);
    // El serializador del foro no trae los campos de anuncio; en el evento hay que
    // completarlos porque `CommunityPost` los declara.
    this.eventos$.next({
      sede: post.sede,
      evento: {
        kind: 'post',
        post: { ...serializado, title: null, eventDate: null, userAttends: false },
      },
    });
    return serializado;
  }

  // CA5.1: post automático al notificar a la comunidad desde una alerta de pánico
  async createPanicAlertPost(patientId: string, sede: string) {
    return this.createPost(
      {
        body: '🆘 Necesito el apoyo de la comunidad ahora mismo. Si puedes, respóndeme con un mensaje.',
        sede,
      },
      patientId,
    );
  }

  // CA5.2: post automático al compartir una insignia con la comunidad
  async createBadgeAnnouncementPost(patientId: string, milestone: number, sede: string) {
    return this.createPost(
      {
        // Con la insignia de 1 día publicaba "¡Alcancé 1 días sin apostar!"
        body: `🏅 ¡Alcancé ${milestone} día${milestone === 1 ? '' : 's'} sin apostar! Gracias a todos por el apoyo de la comunidad.`,
        sede,
      },
      patientId,
      { achievementDays: milestone },
    );
  }

  async addReaction(postId: string, emoji: ReactionEmoji, userId: string) {
    const post = await this.postRepo.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('Publicación no encontrada');

    const existing = await this.reactionRepo.findOne({
      where: { postId, authorId: userId, emoji },
    });
    if (!existing) {
      await this.reactionRepo.save(
        this.reactionRepo.create({ postId, authorId: userId, emoji }),
      );
      await this.notifyInteraction(post, userId, 'reaccionó a');
    }
    return this.reactionSummary(postId, userId);
  }

  async removeReaction(postId: string, emoji: ReactionEmoji, userId: string) {
    const existing = await this.reactionRepo.findOne({
      where: { postId, authorId: userId, emoji },
    });
    if (existing) await this.reactionRepo.delete(existing.id);
    return this.reactionSummary(postId, userId);
  }

  /** Los mensajes que citan a este, del más viejo al más nuevo. */
  async findReplies(postId: string) {
    const post = await this.postRepo.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('Publicación no encontrada');

    const respuestas = await this.postRepo.find({
      where: { replyToId: postId },
      relations: ['author', 'replyTo', 'replyTo.author'],
      order: { createdAt: 'ASC' },
    });
    const reacciones = respuestas.length
      ? await this.reactionRepo.find({ where: { postId: In(respuestas.map((r) => r.id)) } })
      : [];
    const porMensaje = this.groupReactionsByPost(reacciones);
    return respuestas.map((r) => this.serializePost(r, porMensaje.get(r.id) ?? [], 0, postId));
  }

  /**
   * Responder es publicar citando. Se conserva como endpoint propio porque las apps ya
   * instaladas lo llaman, pero por dentro es un mensaje más del foro.
   */
  async createReply(postId: string, dto: CreateReplyDto, authorId: string) {
    return this.createPost(
      { body: dto.body, replyToId: postId, clientRequestId: dto.clientRequestId },
      authorId,
    );
  }

  // CA5.3: el denunciante indica un motivo, que queda registrado con el reporte
  async reportPost(postId: string, reporterId: string, reason: string) {
    const post = await this.postRepo.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('Publicación no encontrada');

    const existing = await this.reportRepo.findOne({ where: { postId, reporterId } });
    if (!existing) {
      await this.reportRepo.save(this.reportRepo.create({ postId, reporterId, reason }));
      await this.postRepo.increment({ id: postId }, 'reportCount', 1);
    }
    return { reported: true };
  }

  // CA3: cola de moderación — publicaciones con reportes para revisión del psicólogo
  async findFlaggedPosts(sede: string | undefined, requesterId: string) {
    await this.assertPsychologist(requesterId);
    const where: Record<string, unknown> = { reportCount: MoreThanOrEqual(REPORT_THRESHOLD) };
    if (sede) where['sede'] = sede;
    const posts = await this.postRepo.find({
      where,
      relations: ['author'],
      order: { reportCount: 'DESC' },
    });
    if (!posts.length) return [];

    // Los motivos van sin identificar al denunciante: saber quién reportó a quién
    // desincentiva reportar, y para moderar basta con el motivo.
    const reports = await this.reportRepo.find({
      where: { postId: In(posts.map((p) => p.id)), dismissedAt: IsNull() },
      select: ['postId', 'reason'],
      order: { createdAt: 'ASC' },
    });
    const reasonsByPost = new Map<string, string[]>();
    for (const r of reports) {
      if (!reasonsByPost.has(r.postId)) reasonsByPost.set(r.postId, []);
      reasonsByPost.get(r.postId)!.push(r.reason);
    }

    return posts.map((p) => ({
      ...this.serializePost(p, [], 0, requesterId),
      reportReasons: reasonsByPost.get(p.id) ?? [],
    }));
  }

  // El psicólogo revisó los reportes y la publicación se queda. Sale de la cola para todo
  // el equipo (reportCount vuelve a 0) y vuelve a entrar si alguien nuevo la reporta.
  async dismissReports(postId: string, requesterId: string) {
    await this.assertPsychologist(requesterId);
    const post = await this.postRepo.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('Publicación no encontrada');
    const result = await this.reportRepo.update(
      { postId, dismissedAt: IsNull() },
      { dismissedAt: new Date(), dismissedBy: requesterId },
    );
    await this.postRepo.update({ id: postId }, { reportCount: 0 });
    return { dismissed: result.affected ?? 0 };
  }

  // CA3 (psicólogo modera) + CA5.4 (autor elimina su propia publicación)
  async deletePost(postId: string, requesterId: string) {
    const post = await this.postRepo.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('Publicación no encontrada');
    if (post.authorId !== requesterId) {
      await this.assertPsychologist(requesterId);
    }
    await this.postRepo.delete(postId);
    return { deleted: true };
  }

  // CA5.5: notificar al autor cuando alguien reacciona o responde a su post
  // CA5.6: no notificar si el autor silenció las notificaciones de comunidad
  /**
   * Avisa por push a la sede que alguien escribió, como un grupo de WhatsApp.
   *
   * **El mensaje no viaja en la notificación**, solo quién escribió: la pantalla de bloqueo
   * la ve cualquiera que pase cerca y en el foro se habla de recaídas y de días difíciles.
   * Decisión del PO del 22-09.
   *
   * No se espera a que termine ni se propaga su error: un problema de Firebase no puede
   * tumbar la publicación, que ya está guardada y es lo que importa.
   */
  private async avisarALaSede(post: CommunityPost, autor: User): Promise<void> {
    try {
      const formas = await this.formasDeSede(post.sede);
      const vecinos = await this.userRepo.find({
        // El equipo clínico queda fuera: un psicólogo con dos sedes recibiría el teléfono
        // encendido todo el día, y ya tiene la vista de comunidad para mirarlo cuando quiera.
        where: { sedeId: In(formas), role: In(['patient', 'sponsor']) },
        select: ['id'],
      });

      const silenciados = await this.communityMuteRepo.find({ select: ['userId'] });
      const mudos = new Set(silenciados.map((m) => m.userId));

      const destinatarios = vecinos
        .map((v) => v.id)
        .filter((id) => id !== post.authorId && !mudos.has(id));
      if (!destinatarios.length) return;

      await this.pushService.enviarAUsuarios(
        destinatarios,
        `Comunidad de ${post.sede}`,
        `${autor.firstName} ${autor.lastName} escribió en la comunidad`,
        'comunidad',
      );
    } catch {
      // Ver arriba: el push es un extra sobre algo que ya quedó publicado.
    }
  }

  private async notifyInteraction(post: CommunityPost, actorId: string, verb: string) {
    if (post.authorId === actorId) return;
    const muted = await this.communityMuteRepo.findOne({ where: { userId: post.authorId } });
    if (muted) return;
    const actor = await this.userRepo.findOne({ where: { id: actorId } });
    const actorName = actor ? `${actor.firstName} ${actor.lastName}` : 'Alguien';
    await this.notificationRepo.save(
      this.notificationRepo.create({
        userId: post.authorId,
        type: 'info',
        title: 'Nueva interacción',
        target: 'community',
        body: `${actorName} ${verb} tu publicación en Comunidad`,
      }),
    );
  }

  private async assertPsychologist(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || user.role !== 'psychologist') {
      throw new ForbiddenException('Solo un psicólogo puede moderar la comunidad');
    }
  }

  private async reactionSummary(postId: string, userId: string) {
    const reactions = await this.reactionRepo.find({ where: { postId } });
    return { reactions: this.buildReactionSummaries(reactions, userId) };
  }

  private groupReactionsByPost(reactions: PostReaction[]): Map<string, PostReaction[]> {
    const map = new Map<string, PostReaction[]>();
    for (const r of reactions) {
      if (!map.has(r.postId)) map.set(r.postId, []);
      map.get(r.postId)!.push(r);
    }
    return map;
  }

  private buildReactionSummaries(reactions: PostReaction[], userId: string): ReactionSummary[] {
    const byEmoji = new Map<string, { count: number; userReacted: boolean }>();
    for (const r of reactions) {
      const cur = byEmoji.get(r.emoji) ?? { count: 0, userReacted: false };
      cur.count++;
      if (r.authorId === userId) cur.userReacted = true;
      byEmoji.set(r.emoji, cur);
    }
    return Array.from(byEmoji.entries()).map(([emoji, d]) => ({
      emoji: emoji as ReactionEmoji,
      count: d.count,
      userReacted: d.userReacted,
    }));
  }

  private serializeAnnouncement(p: CommunityPost, userAttends: boolean) {
    return {
      id: p.id,
      authorId: p.authorId,
      authorName: `${p.author.firstName} ${p.author.lastName}`,
      authorRole: p.author.role,
      type: p.type,
      sede: p.sede,
      title: p.title,
      body: p.body,
      eventDate: p.eventDate?.toISOString() ?? null,
      userAttends,
      createdAt: p.createdAt.toISOString(),
    };
  }

  private serializePost(
    p: CommunityPost,
    reactions: PostReaction[],
    replyCount: number,
    userId: string,
  ) {
    return {
      id: p.id,
      authorId: p.authorId,
      authorName: `${p.author.firstName} ${p.author.lastName}`,
      authorRole: p.author.role,
      type: p.type,
      sede: p.sede,
      body: p.body,
      reportCount: p.reportCount,
      replyCount,
      reactions: this.buildReactionSummaries(reactions, userId),
      replyTo: this.citar(p.replyTo),
      achievementDays: p.achievementDays ?? null,
      createdAt: p.createdAt.toISOString(),
    };
  }

  /**
   * El mensaje citado, recortado. Va dentro de la respuesta y no en una consulta aparte:
   * pintar la cita es lo primero que se ve al recibir un mensaje, y pedirla después dejaría
   * la burbuja a medio dibujar.
   */
  private citar(original: CommunityPost | null | undefined): QuotedMessage | null {
    if (!original) return null;
    const nombre = original.author
      ? `${original.author.firstName} ${original.author.lastName}`
      : 'Alguien';
    return {
      id: original.id,
      authorName: nombre,
      body:
        original.body.length > LARGO_DE_CITA
          ? `${original.body.slice(0, LARGO_DE_CITA).trimEnd()}…`
          : original.body,
    };
  }

  private serializeReply(r: PostReply) {
    return {
      id: r.id,
      postId: r.postId,
      authorId: r.authorId,
      authorName: `${r.author.firstName} ${r.author.lastName}`,
      authorRole: r.author.role,
      body: r.body,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
