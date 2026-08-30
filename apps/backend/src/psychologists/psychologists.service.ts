import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, QueryFailedError, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { CreatePsychologistResponse, PsychologistListItem } from '@stopbet/shared-types';
import { User } from '../users/entities/user.entity';
import { Sede } from '../sedes/entities/sede.entity';
import { PsychologistSede } from './entities/psychologist-sede.entity';
import { PatientAssignment } from './entities/patient-assignment.entity';
import { CreatePsychologistDto } from './dto/create-psychologist.dto';
import { DeactivatePsychologistDto } from './dto/deactivate-psychologist.dto';
import { UpdateSedesDto } from './dto/update-sedes.dto';
import { resolveSedeId } from './sedes-of-user';

const TEMP_PASSWORD_BYTES = 9; // -> 12 caracteres en base64url
const BCRYPT_ROUNDS = 10;
const PG_UNIQUE_VIOLATION = '23505';

// Ver la nota equivalente en registration.service.ts: el findOne previo no es atómico y la
// restricción única de la BD es la única garantía real bajo concurrencia.
function isDuplicateEmail(err: unknown): boolean {
  return (
    err instanceof QueryFailedError &&
    (err.driverError as { code?: string })?.code === PG_UNIQUE_VIOLATION
  );
}

@Injectable()
export class PsychologistsService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Sede)
    private readonly sedeRepo: Repository<Sede>,
    @InjectRepository(PsychologistSede)
    private readonly psychSedeRepo: Repository<PsychologistSede>,
    @InjectRepository(PatientAssignment)
    private readonly assignmentRepo: Repository<PatientAssignment>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  // COMPATIBILIDAD TEMPORAL: los psicólogos creados antes de psychologist_sedes solo tienen
  // el User.sedeId legado, y el seed tampoco puebla la tabla nueva. Sin este respaldo salen
  // con 0 sedes y reassignAll los rechaza siempre como destino, dejando CA24.3 indemostrable.
  // Se elimina cuando exista una migración que rellene la tabla a partir de User.sedeId.
  private async sedesOf(psychologistId: string): Promise<Sede[]> {
    const links = await this.psychSedeRepo.find({ where: { psychologistId } });
    const sedeIds = links.map((l) => l.sedeId);

    if (sedeIds.length === 0) {
      const user = await this.userRepo.findOne({ where: { id: psychologistId } });
      const legacySedeId = await resolveSedeId(this.sedeRepo, user?.sedeId);
      if (!legacySedeId) return [];
      sedeIds.push(legacySedeId);
    }

    return this.sedeRepo.find({ where: { id: In(sedeIds) } });
  }

  private async toListItem(user: User): Promise<PsychologistListItem> {
    const sedes = await this.sedesOf(user.id);
    // Se traen las asignaciones en vez de contarlas porque reasignar necesita el reparto por
    // sede, no el total. Es la misma cantidad de consultas que el count que había antes.
    const assignments = await this.assignmentRepo.find({
      where: { psychologistId: user.id, active: true },
    });

    const sedeNames = new Map(sedes.map((s) => [s.id, s.name]));
    const counts = new Map<string, number>();
    for (const a of assignments) {
      counts.set(a.sedeId, (counts.get(a.sedeId) ?? 0) + 1);
    }

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      accountStatus: user.accountStatus,
      sedes,
      patientCount: assignments.length,
      patientsBySede: [...counts].map(([sedeId, count]) => ({
        sedeId,
        // Un paciente puede haber quedado en una sede que el psicólogo ya no atiende; se
        // muestra igual, con el id como nombre, en vez de esconderlo del reparto.
        sedeName: sedeNames.get(sedeId) ?? sedeId,
        count,
      })),
    };
  }

  async create(dto: CreatePsychologistDto): Promise<CreatePsychologistResponse> {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Ya existe una cuenta con este correo electrónico');
    }

    const sedes = await this.sedeRepo.find({ where: { id: In(dto.sedeIds), isActive: true } });
    if (sedes.length !== dto.sedeIds.length) {
      throw new BadRequestException('Una o más sedes no existen o están inactivas');
    }

    const temporaryPassword = crypto.randomBytes(TEMP_PASSWORD_BYTES).toString('base64url');
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);

    let user: User;
    try {
      user = await this.userRepo.save(
        this.userRepo.create({
          email: dto.email,
          passwordHash,
          role: 'psychologist',
          firstName: dto.firstName,
          lastName: dto.lastName,
          rut: dto.rut,
          sedeId: dto.sedeIds[0],
          onboardingStatus: 'complete',
          accountStatus: 'active',
        }),
      );
    } catch (err) {
      if (isDuplicateEmail(err)) {
        throw new ConflictException('Ya existe una cuenta con este correo electrónico');
      }
      throw err;
    }

    await this.psychSedeRepo.save(
      dto.sedeIds.map((sedeId) =>
        this.psychSedeRepo.create({ psychologistId: user.id, sedeId }),
      ),
    );

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      sedes,
      temporaryPassword,
    };
  }

  async findAll(): Promise<PsychologistListItem[]> {
    const psychologists = await this.userRepo.find({
      where: { role: 'psychologist' },
      order: { createdAt: 'DESC' },
    });
    // En serie el endpoint tardaba la suma de todos los psicólogos; Promise.all mantiene el
    // orden del arreglo (lo fija la posición, no cuál consulta termina antes).
    // Sigue habiendo un N+1: cada item consulta sus sedes y su conteo por separado. Batchearlo
    // exige un GROUP BY por query builder y romper el respaldo por sede legada, que es por
    // psicólogo; con el volumen de una clínica no compensa todavía.
    return Promise.all(psychologists.map((p) => this.toListItem(p)));
  }

  async findOne(id: string): Promise<PsychologistListItem> {
    const psychologist = await this.userRepo.findOne({ where: { id, role: 'psychologist' } });
    if (!psychologist) throw new NotFoundException('Psicólogo no encontrado');
    return this.toListItem(psychologist);
  }

  // Mueve `assignments` a `targetPsychologistId`, exigiendo que el destino esté activo
  // y atienda TODAS las sedes involucradas — si no, no se mueve nada.
  private async reassignAll(
    manager: EntityManager,
    assignments: PatientAssignment[],
    targetPsychologistId: string,
  ): Promise<void> {
    const target = await manager.getRepository(User).findOne({
      where: { id: targetPsychologistId, role: 'psychologist', accountStatus: 'active' },
    });
    if (!target) {
      throw new NotFoundException('El psicólogo de destino no existe o no está activo');
    }

    const targetLinks = await manager
      .getRepository(PsychologistSede)
      .find({ where: { psychologistId: targetPsychologistId } });

    // Mismo respaldo temporal que en sedesOf(): sin él, un psicólogo preexistente nunca
    // puede recibir pacientes porque no tiene filas en psychologist_sedes.
    const targetLegacySedeId = await resolveSedeId(
      manager.getRepository(Sede),
      target.sedeId,
    );
    const targetSedeIds = new Set(
      targetLinks.length > 0
        ? targetLinks.map((l) => l.sedeId)
        : targetLegacySedeId
          ? [targetLegacySedeId]
          : [],
    );
    const uncovered = assignments.some((a) => !targetSedeIds.has(a.sedeId));
    if (uncovered) {
      throw new BadRequestException(
        'El psicólogo de destino no atiende todas las sedes de los pacientes a reasignar',
      );
    }

    const assignmentRepo = manager.getRepository(PatientAssignment);

    await assignmentRepo.update(
      { id: In(assignments.map((a) => a.id)) },
      { active: false, endedAt: new Date() },
    );
    await assignmentRepo.save(
      assignments.map((a) =>
        assignmentRepo.create({
          patientId: a.patientId,
          psychologistId: targetPsychologistId,
          sedeId: a.sedeId,
          active: true,
          endedAt: null,
        }),
      ),
    );
  }

  // Reasignar y suspender deben ser atómicas: si la suspensión falla después de mover a los
  // pacientes, quedarían con psicólogo nuevo y el viejo seguiría activo.
  async deactivate(id: string, dto: DeactivatePsychologistDto): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const psychologist = await manager
        .getRepository(User)
        .findOne({ where: { id, role: 'psychologist' } });
      if (!psychologist) throw new NotFoundException('Psicólogo no encontrado');

      const activeAssignments = await manager
        .getRepository(PatientAssignment)
        .find({ where: { psychologistId: id, active: true } });

      if (activeAssignments.length > 0) {
        // Los pacientes se reparten por sede: un mismo destino no tiene por qué atender todas
        // las sedes del que se va, y exigirlo dejaba bajas imposibles de completar.
        const bySede = new Map<string, PatientAssignment[]>();
        for (const a of activeAssignments) {
          const group = bySede.get(a.sedeId);
          if (group) group.push(a);
          else bySede.set(a.sedeId, [a]);
        }

        const targets = new Map<string, string>();
        for (const sedeId of bySede.keys()) {
          const target = dto.reassignments?.[sedeId] ?? dto.reassignTo;
          if (target) targets.set(sedeId, target);
        }

        if (targets.size < bySede.size) {
          throw new ConflictException({
            message:
              'El psicólogo tiene pacientes activos: reasígnalos antes de desactivar la cuenta',
            patientIds: activeAssignments.map((a) => a.patientId),
            bySede: [...bySede]
              .filter(([sedeId]) => !targets.has(sedeId))
              .map(([sedeId, group]) => ({
                sedeId,
                patientIds: group.map((a) => a.patientId),
              })),
          });
        }

        for (const [sedeId, group] of bySede) {
          const target = targets.get(sedeId) as string;
          if (target === id) {
            throw new BadRequestException(
              'No puedes reasignar pacientes al mismo psicólogo que se está desactivando',
            );
          }
          await this.reassignAll(manager, group, target);
        }
      }

      await manager.getRepository(User).update(id, { accountStatus: 'suspended' });
    });
  }

  // Tres escrituras encadenadas (reasignar, quitar vínculos, agregar vínculos): si falla la
  // segunda, el psicólogo se queda sin los pacientes y con las sedes viejas.
  async updateSedes(id: string, dto: UpdateSedesDto): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const psychologist = await manager
        .getRepository(User)
        .findOne({ where: { id, role: 'psychologist' } });
      if (!psychologist) throw new NotFoundException('Psicólogo no encontrado');

      const sedes = await manager
        .getRepository(Sede)
        .find({ where: { id: In(dto.sedeIds), isActive: true } });
      if (sedes.length !== dto.sedeIds.length) {
        throw new BadRequestException('Una o más sedes no existen o están inactivas');
      }

      const psychSedeRepo = manager.getRepository(PsychologistSede);
      const current = await psychSedeRepo.find({ where: { psychologistId: id } });
      const currentSedeIds = new Set(current.map((l) => l.sedeId));
      const nextSedeIds = new Set(dto.sedeIds);

      const toRemove = current.filter((l) => !nextSedeIds.has(l.sedeId));
      const toAdd = dto.sedeIds.filter((sedeId) => !currentSedeIds.has(sedeId));

      for (const link of toRemove) {
        const assignments = await manager
          .getRepository(PatientAssignment)
          .find({ where: { psychologistId: id, sedeId: link.sedeId, active: true } });
        if (assignments.length === 0) continue;

        const reassignTo = dto.reassignments?.[link.sedeId];
        if (!reassignTo) {
          throw new ConflictException({
            message:
              'El psicólogo tiene pacientes activos en una sede que se está quitando: reasígnalos primero',
            sedeId: link.sedeId,
            patientIds: assignments.map((a) => a.patientId),
          });
        }
        if (reassignTo === id) {
          throw new BadRequestException(
            'No puedes reasignar pacientes al mismo psicólogo que está quitando esa sede',
          );
        }
        await this.reassignAll(manager, assignments, reassignTo);
      }

      if (toRemove.length > 0) {
        await psychSedeRepo.delete({ id: In(toRemove.map((l) => l.id)) });
      }
      if (toAdd.length > 0) {
        await psychSedeRepo.save(
          toAdd.map((sedeId) => psychSedeRepo.create({ psychologistId: id, sedeId })),
        );
      }

      // `User.sedeId` viaja dentro del JWT (`AuthService.issueTokens`), así que si se quita
      // justo la sede legada y no se realinea, el psicólogo sigue emitiendo tokens que lo
      // declaran en una sede que ya no atiende. Y como `sedesOf()` la usa de respaldo cuando
      // no hay filas en psychologist_sedes, una sede legada obsoleta reaparecería como propia.
      // Se mantiene la invariante de `create()`: la sede legada siempre es una de las suyas.
      const legacySedeId = await resolveSedeId(
        manager.getRepository(Sede),
        psychologist.sedeId,
      );
      if (!legacySedeId || !nextSedeIds.has(legacySedeId)) {
        await manager.getRepository(User).update(id, { sedeId: dto.sedeIds[0] ?? null });
      }
    });
  }
}
