import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull, MoreThanOrEqual, Not, QueryFailedError, Raw, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AccountStatus, AuthUser, cleanRut, RegisterFamilyResponse } from '@stopbet/shared-types';
import { FamilyLink, FamilyLinkStatus } from './entities/family-link.entity';
import { FamilyLinkReview, FamilyLinkVerdict } from './entities/family-link-review.entity';
import { FamilySession } from './entities/family-session.entity';
import { SessionAttendance } from './entities/session-attendance.entity';
import { User } from '../users/entities/user.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { Sede } from '../sedes/entities/sede.entity';
import { PsychologistSede } from '../psychologists/entities/psychologist-sede.entity';
import { resolveSedeId, sedeIdsOfPsychologist } from '../psychologists/sedes-of-user';
import { Invoice } from '../billing/entities/invoice.entity';
import { CreateFamilyLinkDto } from './dto/create-family-link.dto';
import { CreateFamilySessionDto } from './dto/create-family-session.dto';
import { ConfirmAttendanceDto } from './dto/confirm-attendance.dto';
import { RegisterFamilyDto } from './dto/register-family.dto';

const UPCOMING_WEEKS = 4;
const BCRYPT_ROUNDS = 10;
const PG_UNIQUE_VIOLATION = '23505';

// Ver la nota equivalente en registration.service.ts: el findOne previo no es atómico y la
// restricción única de la BD es la única garantía real bajo concurrencia.
function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof QueryFailedError &&
    (err.driverError as { code?: string })?.code === PG_UNIQUE_VIOLATION
  );
}

// 'unlinked' no es un estado de FamilyLink: es la ausencia de vínculo (ninguna fila).
export type FamilyLinkState = FamilyLinkStatus | 'unlinked';

const LINK_PRIORITY: Record<FamilyLinkStatus, number> = {
  active: 3,
  pending: 2,
  revoked: 1,
  rejected: 0,
};

export type FamilySessionView = FamilySession & { userAttends: boolean | null };

export interface FamilySessionsView {
  linkStatus: FamilyLinkState;
  sessions: FamilySessionView[];
  hasUpcoming: boolean;
}

// Sólo lo que el psicólogo necesita para pasar lista: nada del resto del User.
export interface SessionAttendanceView {
  id: string;
  sessionId: string;
  familyUserId: string;
  familyUserName: string;
  confirmed: boolean;
  confirmedAt: Date;
}

// CA 11.4 — lo que ve el psicólogo: la sesión más quién respondió y qué.
export interface SedeSessionView {
  id: string;
  title: string;
  sessionDate: Date;
  location: string;
  isOnline: boolean;
  confirmedCount: number;
  declinedCount: number;
  attendances: SessionAttendanceView[];
}

export interface FamilyInvoiceView {
  month: string;
  amountCLP: number;
  dueDate: string;
}

// Lo mínimo para que el familiar pague: el nombre de pila del paciente y sus cuotas,
// nada del resto de su cuenta.
export interface FamilyBillingView {
  linkStatus: FamilyLinkState;
  patientFirstName: string | null;
  accountStatus: AccountStatus | null;
  overdueInvoices: FamilyInvoiceView[];
  totalOwedCLP: number;
  nextInvoice: FamilyInvoiceView | null;
}

const EMPTY_BILLING = (linkStatus: FamilyLinkState): FamilyBillingView => ({
  linkStatus,
  patientFirstName: null,
  accountStatus: null,
  overdueInvoices: [],
  totalOwedCLP: 0,
  nextInvoice: null,
});

const toInvoiceView = (i: Invoice): FamilyInvoiceView => ({
  month: i.month,
  amountCLP: i.amountCLP,
  dueDate: i.dueDate,
});

const EMPTY_VIEW = (linkStatus: FamilyLinkState): FamilySessionsView => ({
  linkStatus,
  sessions: [],
  hasUpcoming: false,
});

// HDU 23 — lo que ve el psicólogo en "Familiares pendientes"/"Familiares vinculados".
export interface FamilyLinkListItem {
  id: string;
  familyUserId: string;
  familyName: string;
  familyEmail: string;
  patientUserId: string;
  patientName: string;
  sedeId: string | null;
  createdAt: string;
}

@Injectable()
export class FamilyService {
  constructor(
    @InjectRepository(FamilyLink)
    private readonly linkRepo: Repository<FamilyLink>,
    @InjectRepository(FamilySession)
    private readonly sessionRepo: Repository<FamilySession>,
    @InjectRepository(SessionAttendance)
    private readonly attendanceRepo: Repository<SessionAttendance>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
    @InjectRepository(Sede)
    private readonly sedeRepo: Repository<Sede>,
    @InjectRepository(PsychologistSede)
    private readonly psychSedeRepo: Repository<PsychologistSede>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  // ── Vínculo familiar ↔ paciente ───────────────────────────────────────────

  // HDU 22 — alta pública de la cuenta del familiar, declarando el RUT del paciente. A
  // diferencia de requestLink() (que asume una sesión de familiar ya creada), acá la cuenta
  // y el vínculo nacen juntos en un solo paso.
  async registerFamily(dto: RegisterFamilyDto): Promise<RegisterFamilyResponse> {
    const cleanFamilyRut = cleanRut(dto.rut);

    const emailTaken = await this.userRepo.findOne({ where: { email: dto.email } });
    if (emailTaken) {
      throw new ConflictException('Ya existe una cuenta con esos datos');
    }

    // El RUT va cifrado con IV aleatorio (encrypted-column.transformer): el mismo RUT cifra
    // distinto cada vez, así que no se puede filtrar por columna — se compara en memoria.
    // Con el volumen actual de cuentas es intrascendente; a diferencia del correo, no hay
    // restricción única en la BD que cierre la carrera bajo concurrencia — la solución real
    // es una columna `rutHash` (HMAC) determinista e indexada, que queda como deuda.
    const existingUsers = await this.userRepo.find({ select: ['id', 'rut'] });
    if (existingUsers.some((u) => u.rut && cleanRut(u.rut) === cleanFamilyRut)) {
      throw new ConflictException('Ya existe una cuenta con esos datos');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const patient = await this.findDeclaredPatient(dto);

    const familyUser = await this.dataSource.transaction(async (manager) => {
      let created: User;
      try {
        created = await manager.getRepository(User).save(
          manager.getRepository(User).create({
            email: dto.email,
            passwordHash,
            role: 'family',
            firstName: dto.firstName,
            lastName: dto.lastName,
            rut: dto.rut,
            phone: dto.phone ?? null,
            accountStatus: 'active',
          }),
        );
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw new ConflictException('Ya existe una cuenta con esos datos');
        }
        throw err;
      }

      await this.declareLink(manager, created, dto, patient, 'registered');
      return created;
    });

    // CA2 — misma respuesta exista o no el paciente: no delata si hubo coincidencia.
    return { userId: familyUser.id, status: 'pending' };
  }

  // Con RUT y correo a la vez, los dos tienen que apuntar al mismo paciente; si no, cuenta
  // como que no hubo coincidencia.
  private async findDeclaredPatient(dto: CreateFamilyLinkDto): Promise<User | null> {
    const byRut = dto.patientRut ? await this.findPatientByRut(dto.patientRut) : undefined;
    const byEmail = dto.patientEmail ? await this.findPatientByEmail(dto.patientEmail) : undefined;
    if (byRut !== undefined && byEmail !== undefined) {
      return byRut && byEmail && byRut.id === byEmail.id ? byRut : null;
    }
    return byRut ?? byEmail ?? null;
  }

  private async findPatientByRut(rut: string): Promise<User | null> {
    const target = cleanRut(rut);
    const patients = await this.userRepo.find({
      where: { role: 'patient' },
      select: ['id', 'rut', 'sedeId'],
    });
    return patients.find((p) => p.rut && cleanRut(p.rut) === target) ?? null;
  }

  // El correo se guarda tal como se escribió al crear la cuenta, y "Carlos@…" y "carlos@…" son
  // la misma casilla: se compara sin mayúsculas.
  private findPatientByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: {
        role: 'patient',
        email: Raw((alias) => `LOWER(${alias}) = LOWER(:email)`, { email: email.trim() }),
      },
      select: ['id', 'sedeId'],
    });
  }

  // Registra la declaración del familiar y avisa a quien corresponde: si el paciente existe, a
  // los psicólogos de su sede; si no, solo a coordinación (HDU 22, CA2). Quien declaró no se
  // entera de cuál de los dos casos fue.
  private async declareLink(
    manager: EntityManager,
    familyUser: User,
    dto: CreateFamilyLinkDto,
    patient: User | null,
    origin: 'registered' | 'requested',
  ): Promise<void> {
    const linkRepo = manager.getRepository(FamilyLink);

    if (!patient) {
      await linkRepo.save(
        linkRepo.create({
          familyUserId: familyUser.id,
          patientUserId: null,
          declaredPatientRut: dto.patientRut ?? null,
          declaredPatientEmail: dto.patientEmail?.trim() ?? null,
          status: 'pending',
        }),
      );
      await this.notifyCoordinators(manager, familyUser);
      return;
    }

    // La restricción única (familiar, paciente) impide una segunda fila: volver a declarar a un
    // paciente rechazado o revocado reabre la misma. Lo decidido antes sigue en
    // family_link_reviews. Si ya estaba pendiente o activo, no hay nada nuevo que revisar.
    const existing = await linkRepo.findOne({
      where: { familyUserId: familyUser.id, patientUserId: patient.id },
    });
    if (existing) {
      const reopened = await linkRepo.update(
        { id: existing.id, status: In(['rejected', 'revoked']) },
        { status: 'pending' },
      );
      if (!reopened.affected) return;
    } else {
      await linkRepo.save(
        linkRepo.create({
          familyUserId: familyUser.id,
          patientUserId: patient.id,
          declaredPatientRut: null,
          declaredPatientEmail: null,
          status: 'pending',
        }),
      );
    }
    await this.notifyPsychologistsOfSede(manager, patient.sedeId, familyUser, origin);
  }

  private async notifyPsychologistsOfSede(
    manager: EntityManager,
    rawSedeId: string | null,
    familyUser: User,
    origin: 'registered' | 'requested',
  ): Promise<void> {
    const sedeId = await resolveSedeId(manager.getRepository(Sede), rawSedeId);
    if (!sedeId) return;

    // Misma regla con la que listLinksByStatus decide quién ve la solicitud
    // (sedeIdsOfPsychologist). Antes el respaldo legado solo corría si NINGÚN psicólogo de la
    // sede tenía fila en psychologist_sedes: con sedes mixtas, uno veía el pendiente sin aviso.
    const psychologists = await manager.getRepository(User).find({
      where: { role: 'psychologist', accountStatus: 'active' },
    });
    const psychIds: string[] = [];
    for (const p of psychologists) {
      const sedes = await sedeIdsOfPsychologist(
        manager.getRepository(PsychologistSede),
        manager.getRepository(Sede),
        p.id,
        p.sedeId,
      );
      if (sedes.includes(sedeId)) psychIds.push(p.id);
    }
    if (psychIds.length === 0) return;

    const name = `${familyUser.firstName} ${familyUser.lastName}`;
    const body =
      origin === 'registered'
        ? `${name} se registró como familiar de un paciente de tu sede. Revísalo en Familiares pendientes.`
        : `${name} pidió vincularse como familiar de un paciente de tu sede. Revísalo en Familiares pendientes.`;
    const notifRepo = manager.getRepository(Notification);
    await notifRepo.save(
      psychIds.map((userId) =>
        notifRepo.create({
          userId,
          type: 'info',
          title: 'Nuevo familiar por vincular',
          body,
          target: 'family-links',
        }),
      ),
    );
  }

  private async notifyCoordinators(manager: EntityManager, familyUser: User): Promise<void> {
    const coordinators = await manager.getRepository(User).find({ where: { role: 'coordinator' } });
    if (coordinators.length === 0) return;

    const notifRepo = manager.getRepository(Notification);
    await notifRepo.save(
      coordinators.map((c) =>
        notifRepo.create({
          userId: c.id,
          type: 'warning',
          title: 'Familiar con un paciente que no está en el sistema',
          body: `${familyUser.firstName} ${familyUser.lastName} (${familyUser.email}) declaró un paciente que no corresponde a ninguna cuenta.`,
        }),
      ),
    );
  }

  // Para un familiar que ya tiene cuenta y quiere declarar (otra vez) a su paciente: se equivocó
  // de RUT al registrarse, o le rechazaron la solicitud. Responde lo mismo exista o no el
  // paciente: antes devolvía 404 ante un correo desconocido, y con eso cualquier familiar podía
  // averiguar quién se atiende en AJUTER.
  async requestLink(familyUserId: string, dto: CreateFamilyLinkDto): Promise<{ status: 'pending' }> {
    const current = await this.currentLinkFor(familyUserId);
    if (current?.status === 'active') {
      throw new ConflictException('Ya tienes un vínculo activo con un paciente');
    }

    const familyUser = await this.userRepo.findOne({ where: { id: familyUserId } });
    if (!familyUser) throw new NotFoundException('Cuenta no encontrada');

    const patient = await this.findDeclaredPatient(dto);
    try {
      await this.dataSource.transaction((manager) =>
        this.declareLink(manager, familyUser, dto, patient, 'requested'),
      );
    } catch (err) {
      // Dos pedidos simultáneos por el mismo paciente: el segundo choca con la restricción
      // única, y el vínculo ya quedó pendiente por el primero.
      if (!isUniqueViolation(err)) throw err;
    }
    return { status: 'pending' };
  }

  // Un familiar puede tener más de un vínculo (uno rechazado por RUT equivocado y otro activo,
  // por ejemplo). Un findOne sin orden dejaba a Postgres elegir, y el portal podía mostrar
  // "rechazado" a quien sí tiene acceso. Manda el que da más acceso y, entre iguales, el último.
  private async currentLinkFor(familyUserId: string): Promise<FamilyLink | null> {
    const links = await this.linkRepo.find({
      where: { familyUserId },
      relations: ['patientUser'],
      order: { createdAt: 'DESC' },
    });
    if (links.length === 0) return null;
    return links.reduce((best, l) => (LINK_PRIORITY[l.status] > LINK_PRIORITY[best.status] ? l : best));
  }

  // CA 11.6 — estado del vínculo del familiar
  async getLinkStatus(familyUserId: string): Promise<{ status: FamilyLinkState }> {
    const link = await this.currentLinkFor(familyUserId);
    if (!link) return { status: 'unlinked' };
    return { status: link.status };
  }

  // ── Revisión del vínculo por el psicólogo (HDU 23) ─────────────────────────

  // El coordinador revisa cualquier sede; un psicólogo, solo las suyas. Mismo criterio
  // que RegistrationService.reviewableSedeIds — ver la nota ahí sobre por qué.
  private async reviewableSedeIds(reviewer: AuthUser): Promise<string[] | null> {
    if (reviewer.role === 'coordinator') return null;
    return sedeIdsOfPsychologist(this.psychSedeRepo, this.sedeRepo, reviewer.id, reviewer.sedeId);
  }

  private async assertCoversSede(reviewer: AuthUser, rawSedeId: string | null): Promise<void> {
    const sedeIds = await this.reviewableSedeIds(reviewer);
    if (sedeIds === null) return;
    const resolved = await resolveSedeId(this.sedeRepo, rawSedeId);
    if (!resolved || !sedeIds.includes(resolved)) {
      throw new ForbiddenException('No puedes revisar vínculos de una sede que no atiendes');
    }
  }

  private async listLinksByStatus(
    status: FamilyLinkStatus,
    reviewer: AuthUser,
  ): Promise<FamilyLinkListItem[]> {
    const links = await this.linkRepo.find({
      // patientUserId nulo = RUT que no correspondía a ningún paciente (HDU 22, CA2): esos
      // nunca son visibles para un psicólogo, solo quedaron alertados a coordinación.
      where: { status, patientUserId: Not(IsNull()) },
      relations: ['familyUser', 'patientUser'],
      order: { createdAt: 'DESC' },
    });

    const sedeIds = await this.reviewableSedeIds(reviewer);
    const result: FamilyLinkListItem[] = [];
    for (const link of links) {
      if (!link.patientUser) continue; // ya excluidos por el where; guarda de tipos
      if (sedeIds !== null) {
        const resolved = await resolveSedeId(this.sedeRepo, link.patientUser.sedeId);
        if (!resolved || !sedeIds.includes(resolved)) continue;
      }
      result.push({
        id: link.id,
        familyUserId: link.familyUserId,
        familyName: `${link.familyUser.firstName} ${link.familyUser.lastName}`.trim(),
        familyEmail: link.familyUser.email,
        patientUserId: link.patientUser.id,
        patientName: `${link.patientUser.firstName} ${link.patientUser.lastName}`.trim(),
        sedeId: link.patientUser.sedeId,
        createdAt: link.createdAt.toISOString(),
      });
    }
    return result;
  }

  // CA1 — familiares pendientes de la sede del psicólogo.
  listPendingLinks(reviewer: AuthUser): Promise<FamilyLinkListItem[]> {
    return this.listLinksByStatus('pending', reviewer);
  }

  // Para poder revocar (CA5) hace falta saber a quién: los vínculos activos de la sede.
  listActiveLinks(reviewer: AuthUser): Promise<FamilyLinkListItem[]> {
    return this.listLinksByStatus('active', reviewer);
  }

  // CA2 — confirma el vínculo, habilita las funcionalidades del familiar y notifica a
  // ambas partes. `getSessionsForFamily`/`getLinkStatus` ya reaccionan solos al cambio de
  // estado: no hace falta tocar nada más para "habilitar" el acceso.
  async confirmLink(linkId: string, reviewer: AuthUser): Promise<void> {
    const link = await this.linkRepo.findOne({
      where: { id: linkId },
      relations: ['familyUser', 'patientUser'],
    });
    if (!link || !link.patientUser) throw new NotFoundException('Vínculo no encontrado');

    const patient = link.patientUser;
    await this.assertCoversSede(reviewer, patient.sedeId);

    // Update condicional: dos confirmaciones simultáneas no deben notificar dos veces
    // (mismo patrón que RegistrationService.approve).
    await this.dataSource.transaction(async (manager) => {
      await this.applyVerdict(manager, linkId, 'pending', 'confirmed', reviewer, 'El vínculo ya fue procesado');
      const notifRepo = manager.getRepository(Notification);
      await notifRepo.save([
        notifRepo.create({
          userId: link.familyUserId,
          type: 'success',
          title: '¡Tu vínculo fue confirmado!',
          body: `Ya puedes ver las sesiones grupales y el estado de ${patient.firstName}.`,
        }),
        notifRepo.create({
          userId: patient.id,
          type: 'info',
          title: 'Un familiar fue vinculado a tu cuenta',
          body: `${link.familyUser.firstName} ${link.familyUser.lastName} ahora puede ver tus sesiones grupales.`,
        }),
      ]);
    });
  }

  // CA3 — rechaza el vínculo: la cuenta del familiar queda sin vincular, solo se notifica
  // a él (el paciente nunca supo del intento, y así se mantiene).
  async rejectLink(linkId: string, reviewer: AuthUser): Promise<void> {
    const link = await this.linkRepo.findOne({ where: { id: linkId }, relations: ['patientUser'] });
    if (!link || !link.patientUser) throw new NotFoundException('Vínculo no encontrado');

    await this.assertCoversSede(reviewer, link.patientUser.sedeId);

    await this.dataSource.transaction(async (manager) => {
      await this.applyVerdict(manager, linkId, 'pending', 'rejected', reviewer, 'El vínculo ya fue procesado');
      const notifRepo = manager.getRepository(Notification);
      await notifRepo.save(
        notifRepo.create({
          userId: link.familyUserId,
          type: 'warning',
          title: 'Tu solicitud de vinculación no fue aprobada',
          body: 'El equipo clínico revisó tu solicitud y no pudo confirmar el vínculo declarado.',
        }),
      );
    });
  }

  // CA5 — revoca un vínculo activo: retira el acceso a sesiones de inmediato (mismo
  // mecanismo de confirmLink, en reversa) y notifica a ambas partes.
  async revokeLink(linkId: string, reviewer: AuthUser): Promise<void> {
    const link = await this.linkRepo.findOne({
      where: { id: linkId },
      relations: ['familyUser', 'patientUser'],
    });
    if (!link || !link.patientUser) throw new NotFoundException('Vínculo no encontrado');

    const patient = link.patientUser;
    await this.assertCoversSede(reviewer, patient.sedeId);

    await this.dataSource.transaction(async (manager) => {
      await this.applyVerdict(manager, linkId, 'active', 'revoked', reviewer, 'El vínculo no está activo');
      const notifRepo = manager.getRepository(Notification);
      await notifRepo.save([
        notifRepo.create({
          userId: link.familyUserId,
          type: 'warning',
          title: 'Tu acceso como familiar fue revocado',
          body: 'El equipo clínico retiró tu vínculo. Ya no puedes ver las sesiones ni el estado del paciente.',
        }),
        notifRepo.create({
          userId: patient.id,
          type: 'info',
          title: 'Se retiró el acceso de un familiar',
          body: `${link.familyUser.firstName} ${link.familyUser.lastName} ya no puede ver tus sesiones grupales.`,
        }),
      ]);
    });
  }

  // CA6 — el cambio de estado y su fila de auditoría van en la misma transacción: una decisión
  // no puede quedar aplicada sin registro, ni registrada sin aplicarse.
  private async applyVerdict(
    manager: EntityManager,
    linkId: string,
    from: FamilyLinkStatus,
    verdict: FamilyLinkVerdict,
    reviewer: AuthUser,
    conflictMessage: string,
  ): Promise<void> {
    const to: Record<FamilyLinkVerdict, FamilyLinkStatus> = {
      confirmed: 'active',
      rejected: 'rejected',
      revoked: 'revoked',
    };
    const result = await manager.getRepository(FamilyLink).update(
      { id: linkId, status: from },
      { status: to[verdict], reviewedBy: reviewer.id, reviewedAt: new Date() },
    );
    if (!result.affected) throw new ConflictException(conflictMessage);

    const reviewRepo = manager.getRepository(FamilyLinkReview);
    await reviewRepo.save(reviewRepo.create({ linkId, verdict, reviewedBy: reviewer.id }));
  }

  // ── Mensualidad ───────────────────────────────────────────────────────────

  // Solo lectura: el cobro todavía no tiene pasarela (ASUNCIONES-PENDIENTES, puntos 4 y 6),
  // así que el familiar ve qué hay que pagar pero nada de acá marca una cuota como pagada.
  async getBillingForFamily(familyUserId: string): Promise<FamilyBillingView> {
    const link = await this.currentLinkFor(familyUserId);

    if (!link) return EMPTY_BILLING('unlinked');
    if (link.status !== 'active' || !link.patientUser) return EMPTY_BILLING(link.status);

    const patientId = link.patientUserId;
    const [overdue, next] = await Promise.all([
      this.invoiceRepo.find({
        where: { userId: patientId, status: 'overdue' },
        order: { dueDate: 'ASC' },
      }),
      this.invoiceRepo.findOne({
        where: { userId: patientId, status: 'pending' },
        order: { dueDate: 'ASC' },
      }),
    ]);

    return {
      linkStatus: 'active',
      patientFirstName: link.patientUser.firstName,
      accountStatus: link.patientUser.accountStatus ?? 'active',
      overdueInvoices: overdue.map(toInvoiceView),
      totalOwedCLP: overdue.reduce((sum, i) => sum + i.amountCLP, 0),
      nextInvoice: next ? toInvoiceView(next) : null,
    };
  }

  // ── Sesiones ──────────────────────────────────────────────────────────────

  async createSession(dto: CreateFamilySessionDto): Promise<FamilySession> {
    const session = this.sessionRepo.create({
      ...dto,
      sessionDate: new Date(dto.sessionDate),
      isOnline: dto.isOnline ?? false,
    });
    return this.sessionRepo.save(session);
  }

  // CA 11.1 + 11.5 + 11.6 — sesiones de la sede del paciente vinculado, ordenadas por proximidad.
  // Sin vínculo no es un error: es el estado que la vista de familiar tiene que pintar (11.6).
  async getSessionsForFamily(familyUserId: string): Promise<FamilySessionsView> {
    const link = await this.currentLinkFor(familyUserId);

    if (!link) return EMPTY_VIEW('unlinked');
    if (link.status !== 'active' || !link.patientUser) return EMPTY_VIEW(link.status);

    const { sedeId } = link.patientUser;
    if (!sedeId) return EMPTY_VIEW('active');

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 1);

    const sessions = await this.sessionRepo.find({
      where: { sedeId, sessionDate: MoreThanOrEqual(cutoff) },
      order: { sessionDate: 'ASC' },
    });

    const windowLimit = new Date();
    windowLimit.setDate(windowLimit.getDate() + UPCOMING_WEEKS * 7);
    const hasUpcoming = sessions.some((s) => s.sessionDate <= windowLimit);

    const attendances = await this.attendanceRepo.find({
      where: { familyUserId },
    });
    const attendanceMap = new Map(attendances.map((a) => [a.sessionId, a.confirmed]));

    const enriched = sessions.map((s) => ({
      ...s,
      userAttends: attendanceMap.has(s.id) ? attendanceMap.get(s.id)! : null,
    }));

    return { linkStatus: 'active', sessions: enriched, hasUpcoming };
  }

  // CA 11.4 — confirmar o rechazar asistencia
  async confirmAttendance(
    familyUserId: string,
    sessionId: string,
    dto: ConfirmAttendanceDto,
  ): Promise<SessionAttendance> {
    // Sin este chequeo un familiar pendiente, rechazado o revocado seguía confirmando asistencia
    // a cualquier sesión: revocar (HDU 23 CA5) no le retiraba el acceso del todo.
    const link = await this.currentLinkFor(familyUserId);
    if (!link || link.status !== 'active' || !link.patientUser) {
      throw new ForbiddenException('Tu vínculo con el paciente no está activo');
    }

    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    // Misma respuesta que una sesión inexistente: no confirma que exista en otra sede.
    const [sessionSede, patientSede] = await Promise.all([
      resolveSedeId(this.sedeRepo, session?.sedeId),
      resolveSedeId(this.sedeRepo, link.patientUser.sedeId),
    ]);
    if (!session || !sessionSede || sessionSede !== patientSede) {
      throw new NotFoundException('Sesión no encontrada');
    }

    const existing = await this.attendanceRepo.findOne({ where: { sessionId, familyUserId } });
    if (existing) {
      existing.confirmed = dto.confirmed;
      return this.attendanceRepo.save(existing);
    }

    const attendance = this.attendanceRepo.create({ sessionId, familyUserId, confirmed: dto.confirmed });
    return this.attendanceRepo.save(attendance);
  }

  // Para que el psicólogo vea asistencias en su dashboard (CA 11.4 segunda mitad).
  // Se arma la respuesta a mano: devolver la relación `familyUser` completa expone
  // passwordHash y el RUT ya descifrado por el transformer.
  async getAttendancesForSession(sessionId: string): Promise<SessionAttendanceView[]> {
    const attendances = await this.attendanceRepo.find({
      where: { sessionId },
      relations: ['familyUser'],
      order: { confirmedAt: 'DESC' },
    });

    return attendances.map((a) => ({
      id: a.id,
      sessionId: a.sessionId,
      familyUserId: a.familyUserId,
      familyUserName: `${a.familyUser.firstName} ${a.familyUser.lastName}`.trim(),
      confirmed: a.confirmed,
      confirmedAt: a.confirmedAt,
    }));
  }

  // CA 11.4 — el psicólogo necesita partir de la lista de sesiones de su sede.
  // `getSessionsForFamily` no le sirve: deriva del vínculo del familiar.
  async getSedeSessions(sedeId: string): Promise<SedeSessionView[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 1);

    const sessions = await this.sessionRepo.find({
      where: { sedeId, sessionDate: MoreThanOrEqual(cutoff) },
      order: { sessionDate: 'ASC' },
    });
    if (sessions.length === 0) return [];

    const attendances = await this.attendanceRepo.find({
      where: { sessionId: In(sessions.map((s) => s.id)) },
      relations: ['familyUser'],
      order: { confirmedAt: 'DESC' },
    });

    const bySession = new Map<string, SessionAttendanceView[]>();
    for (const a of attendances) {
      const list = bySession.get(a.sessionId) ?? [];
      list.push({
        id: a.id,
        sessionId: a.sessionId,
        familyUserId: a.familyUserId,
        familyUserName: `${a.familyUser.firstName} ${a.familyUser.lastName}`.trim(),
        confirmed: a.confirmed,
        confirmedAt: a.confirmedAt,
      });
      bySession.set(a.sessionId, list);
    }

    return sessions.map((s) => {
      const list = bySession.get(s.id) ?? [];
      return {
        id: s.id,
        title: s.title,
        sessionDate: s.sessionDate,
        location: s.location,
        isOnline: s.isOnline,
        confirmedCount: list.filter((a) => a.confirmed).length,
        declinedCount: list.filter((a) => !a.confirmed).length,
        attendances: list,
      };
    });
  }
}
