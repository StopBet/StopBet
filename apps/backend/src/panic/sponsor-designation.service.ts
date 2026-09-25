import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Not, Repository } from 'typeorm';
import {
  AuthUser,
  SponsorCandidate,
  SponsorDesignationDto,
} from '@stopbet/shared-types';
import { User } from '../users/entities/user.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { SponsorAssignment } from './entities/sponsor-assignment.entity';
import { SponsorDesignation } from './entities/sponsor-designation.entity';

@Injectable()
export class SponsorDesignationService {
  constructor(
    @InjectRepository(SponsorDesignation)
    private readonly designationRepo: Repository<SponsorDesignation>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(SponsorAssignment)
    private readonly assignmentRepo: Repository<SponsorAssignment>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

  /**
   * Nadie mira a un paciente de otra sede.
   *
   * Va en un solo método a propósito: cuando la comprobación estaba escrita a mano en
   * cada operación, dos de las seis se quedaron sin ella y quedó un endpoint que
   * devolvía nombres de pacientes de cualquier sede a quien supiera el UUID.
   *
   * El coordinador no tiene sede propia (`sedeId: null`) y ve todas: es su rol.
   */
  private mismaSede(patient: User, actor?: AuthUser): void {
    if (actor?.sedeId && patient.sedeId !== actor.sedeId) {
      throw new ForbiddenException('El paciente no pertenece a tu sede');
    }
  }

  /**
   * CA21.2: candidatos a designar — pacientes activos que aún no son padrinos.
   *
   * El listado se acota a la sede de quien consulta. El criterio no lo pide con esas
   * palabras, pero el resto del sprint sí (HdU13 CA5, HdU19 CA5): un psicólogo no ve
   * pacientes de otra sede. El coordinador no tiene sede propia, así que para él no
   * hay filtro.
   */
  async listCandidates(actor: AuthUser): Promise<SponsorCandidate[]> {
    const alreadySponsors = await this.designationRepo.find({
      where: { isActive: true },
      select: ['patientId'],
    });

    const where: FindOptionsWhere<User> = {
      role: 'patient',
      accountStatus: 'active',
    };
    if (actor.sedeId) where.sedeId = actor.sedeId;

    // `Not(In([]))` genera SQL que no filtra nada en algunos drivers, así que la
    // condición solo se agrega cuando hay a quién excluir.
    const excluded = alreadySponsors.map((d) => d.patientId);
    if (excluded.length > 0) where.id = Not(In(excluded));

    const candidates = await this.userRepo.find({
      where,
      order: { firstName: 'ASC', lastName: 'ASC' },
    });

    return candidates.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      sedeId: u.sedeId,
    }));
  }

  /**
   * CA21.1: otorga el rol de padrino y deja registrado quién lo decidió y cuándo.
   */
  async designate(
    patientId: string,
    actor: AuthUser,
  ): Promise<SponsorDesignationDto> {
    const patient = await this.userRepo.findOne({ where: { id: patientId } });
    if (!patient) throw new NotFoundException('El paciente no existe');

    if (patient.role !== 'patient') {
      throw new BadRequestException(
        'Solo un paciente puede ser designado como compañero de viaje',
      );
    }
    if (patient.accountStatus !== 'active') {
      throw new BadRequestException(
        'La cuenta del paciente no está activa',
      );
    }
    this.mismaSede(patient, actor);

    const existing = await this.designationRepo.findOne({
      where: { patientId, isActive: true },
    });
    if (existing) {
      throw new ConflictException('El paciente ya es compañero de viaje');
    }

    const saved = await this.designationRepo.save(
      this.designationRepo.create({
        patientId,
        designatedBy: actor.id,
        isActive: true,
      }),
    );

    // CA21.4: el designado tiene que enterarse por el sistema, no por su psicólogo en
    // la próxima sesión. Desde este momento puede recibir alertas de pánico de otra
    // persona, y eso no puede pasarle de sorpresa.
    await this.notificationRepo.save(
      this.notificationRepo.create({
        userId: patientId,
        type: 'info',
        title: 'Ahora eres compañero de viaje',
        body:
          'Tu psicólogo te designó como compañero de viaje. Desde ahora puedes ' +
          'recibir alertas de pánico de la persona que se te asigne, para acompañarla ' +
          'en un momento de crisis. Si tienes dudas sobre lo que implica, conversa con ' +
          'tu psicólogo.',
      }),
    );

    return this.serialize(saved, patient);
  }

  /**
   * CA21.3: revocar el rol, pero no mientras tenga gente a cargo.
   *
   * Si se revocara con pacientes asignados, esos pacientes quedarían apuntando a un
   * compañero de viaje que ya no lo es y sus alertas de pánico no tendrían a quién
   * llegar — el escenario exacto que HdU20 CA4 trata de evitar.
   */
  async revoke(
    patientId: string,
    actor: AuthUser,
  ): Promise<SponsorDesignationDto> {
    const designation = await this.designationRepo.findOne({
      where: { patientId, isActive: true },
    });
    if (!designation) {
      throw new NotFoundException('El paciente no es compañero de viaje');
    }

    const patient = await this.userRepo.findOne({ where: { id: patientId } });
    if (!patient) throw new NotFoundException('El paciente no existe');

    this.mismaSede(patient, actor);

    const aCargo = await this.assignmentRepo.count({
      where: { sponsorId: patientId, isActive: true },
    });
    if (aCargo > 0) {
      // Solo el número: los nombres de los pacientes no van en un mensaje de error,
      // que termina en logs y en la consola del navegador.
      throw new ConflictException(
        `Tiene ${aCargo} paciente(s) a cargo. Reasígnalos antes de revocar el rol.`,
      );
    }

    designation.isActive = false;
    designation.revokedAt = new Date();
    designation.revokedBy = actor.id;
    const saved = await this.designationRepo.save(designation);

    return this.serialize(saved, patient);
  }

  /**
   * CA20.2: a quién se le puede asignar este paciente.
   *
   * Tres filtros, los tres del criterio: designados como compañero de viaje, activos
   * en la sede *del paciente* (no la de quien consulta — un coordinador asigna dentro
   * de la sede del paciente, no de la suya), y sin el propio paciente en la lista.
   */
  async listAvailable(
    patientId: string,
    actor: AuthUser,
  ): Promise<SponsorCandidate[]> {
    const patient = await this.userRepo.findOne({ where: { id: patientId } });
    if (!patient) throw new NotFoundException('El paciente no existe');
    this.mismaSede(patient, actor);

    const designations = await this.designationRepo.find({
      where: { isActive: true },
      select: ['patientId'],
    });

    const ids = designations
      .map((d) => d.patientId)
      .filter((id) => id !== patientId);
    if (ids.length === 0) return [];

    const where: FindOptionsWhere<User> = {
      id: In(ids),
      accountStatus: 'active',
    };
    if (patient.sedeId) where.sedeId = patient.sedeId;

    const available = await this.userRepo.find({
      where,
      order: { firstName: 'ASC', lastName: 'ASC' },
    });

    return available.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      sedeId: u.sedeId,
    }));
  }

  /**
   * CA20.4: quién acompaña hoy a este paciente, o `null` si no tiene a nadie.
   *
   * `GET /panic/sponsor` no sirve para esto: devuelve el del usuario que llama, y acá
   * quien pregunta es el psicólogo por un paciente suyo.
   */
  async getCurrent(
    patientId: string,
    actor: AuthUser,
  ): Promise<SponsorCandidate | null> {
    const patient = await this.userRepo.findOne({ where: { id: patientId } });
    if (!patient) throw new NotFoundException('El paciente no existe');
    this.mismaSede(patient, actor);

    const assignment = await this.assignmentRepo.findOne({
      where: { patientId, isActive: true },
      relations: ['sponsor'],
    });
    if (!assignment?.sponsor) return null;

    const { id, firstName, lastName, sedeId } = assignment.sponsor;
    return { id, firstName, lastName, sedeId };
  }

  /**
   * CA20.1 y CA20.3: vincula al compañero de viaje y avisa a los dos.
   *
   * El reemplazo no borra nada: cierra la asignación anterior con `isActive: false` y
   * abre una nueva, para que el CA20.3 pueda mostrar quién acompañaba antes.
   */
  async assign(
    patientId: string,
    sponsorId: string,
    actor?: AuthUser,
  ): Promise<void> {
    if (patientId === sponsorId) {
      throw new BadRequestException(
        'Un paciente no puede ser su propio compañero de viaje',
      );
    }

    const patient = await this.userRepo.findOne({ where: { id: patientId } });
    if (!patient) throw new NotFoundException('El paciente no existe');
    // `actor` es opcional porque `POST /panic/assign` delega acá sin pasarlo — esa ruta
    // nunca tuvo control por sede, solo por rol. Las demás validaciones sí corren.
    this.mismaSede(patient, actor);

    const sponsor = await this.userRepo.findOne({ where: { id: sponsorId } });
    if (!sponsor) throw new NotFoundException('El compañero de viaje no existe');

    // Que esté designado es lo que separa este endpoint de asignar a cualquiera:
    // sin esta comprobación el CA20.2 sería solo una sugerencia de la pantalla.
    const designation = await this.designationRepo.findOne({
      where: { patientId: sponsorId, isActive: true },
    });
    if (!designation) {
      throw new BadRequestException(
        'Esa persona no está designada como compañero de viaje',
      );
    }
    if (sponsor.accountStatus !== 'active') {
      throw new BadRequestException(
        'La cuenta del compañero de viaje no está activa',
      );
    }
    if (patient.sedeId !== sponsor.sedeId) {
      throw new BadRequestException(
        'El compañero de viaje debe ser de la misma sede que el paciente',
      );
    }

    await this.assignmentRepo.update(
      { patientId, isActive: true },
      { isActive: false },
    );
    await this.assignmentRepo.save(
      this.assignmentRepo.create({ patientId, sponsorId, isActive: true }),
    );

    // CA20.1: "notifica a ambos". Los dos lados tienen que saberlo — el paciente para
    // saber a quién va a llegarle su alerta, y el compañero de viaje porque desde
    // ahora puede sonarle el teléfono por esta persona.
    await this.notificationRepo.save([
      this.notificationRepo.create({
        userId: patientId,
        type: 'info',
        title: 'Tienes un compañero de viaje',
        body: `${sponsor.firstName} ${sponsor.lastName} va a acompañarte. Si activas el botón de pánico, le llega a esa persona.`,
      }),
      this.notificationRepo.create({
        userId: sponsorId,
        type: 'info',
        title: 'Acompañas a una persona nueva',
        body: `Tu psicólogo te asignó como compañero de viaje de ${patient.firstName} ${patient.lastName}. Vas a recibir sus alertas de pánico.`,
      }),
    ]);
  }

  /**
   * `designatedByName` no sale del actor: al revocar, quien actúa puede ser un
   * psicólogo distinto del que designó, y la designación tiene que seguir atribuida
   * a quien la tomó.
   */
  private async serialize(
    designation: SponsorDesignation,
    patient: User,
  ): Promise<SponsorDesignationDto> {
    const author = await this.userRepo.findOne({
      where: { id: designation.designatedBy },
    });

    return {
      id: designation.id,
      patientId: designation.patientId,
      patientName: `${patient.firstName} ${patient.lastName}`,
      designatedBy: designation.designatedBy,
      designatedByName: author
        ? `${author.firstName} ${author.lastName}`
        : 'Cuenta eliminada',
      designatedAt: designation.designatedAt.toISOString(),
      isActive: designation.isActive,
      revokedAt: designation.revokedAt?.toISOString() ?? null,
    };
  }
}
