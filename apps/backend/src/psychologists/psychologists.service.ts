import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
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
  ) {}

  private async sedesOf(psychologistId: string): Promise<Sede[]> {
    const links = await this.psychSedeRepo.find({ where: { psychologistId } });
    if (links.length === 0) return [];
    return this.sedeRepo.find({ where: { id: In(links.map((l) => l.sedeId)) } });
  }

  private async toListItem(user: User): Promise<PsychologistListItem> {
    const sedes = await this.sedesOf(user.id);
    const patientCount = await this.assignmentRepo.count({
      where: { psychologistId: user.id, active: true },
    });
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      accountStatus: user.accountStatus,
      sedes,
      patientCount,
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
    const result: PsychologistListItem[] = [];
    for (const p of psychologists) {
      result.push(await this.toListItem(p));
    }
    return result;
  }

  async findOne(id: string): Promise<PsychologistListItem> {
    const psychologist = await this.userRepo.findOne({ where: { id, role: 'psychologist' } });
    if (!psychologist) throw new NotFoundException('Psicólogo no encontrado');
    return this.toListItem(psychologist);
  }

  // Mueve `assignments` a `targetPsychologistId`, exigiendo que el destino esté activo
  // y atienda TODAS las sedes involucradas — si no, no se mueve nada.
  private async reassignAll(
    assignments: PatientAssignment[],
    targetPsychologistId: string,
  ): Promise<void> {
    const target = await this.userRepo.findOne({
      where: { id: targetPsychologistId, role: 'psychologist', accountStatus: 'active' },
    });
    if (!target) {
      throw new NotFoundException('El psicólogo de destino no existe o no está activo');
    }

    const targetSedeIds = new Set(
      (await this.psychSedeRepo.find({ where: { psychologistId: targetPsychologistId } })).map(
        (l) => l.sedeId,
      ),
    );
    const uncovered = assignments.some((a) => !targetSedeIds.has(a.sedeId));
    if (uncovered) {
      throw new BadRequestException(
        'El psicólogo de destino no atiende todas las sedes de los pacientes a reasignar',
      );
    }

    await this.assignmentRepo.update(
      { id: In(assignments.map((a) => a.id)) },
      { psychologistId: targetPsychologistId },
    );
  }

  async deactivate(id: string, dto: DeactivatePsychologistDto): Promise<void> {
    const psychologist = await this.userRepo.findOne({ where: { id, role: 'psychologist' } });
    if (!psychologist) throw new NotFoundException('Psicólogo no encontrado');

    const activeAssignments = await this.assignmentRepo.find({
      where: { psychologistId: id, active: true },
    });

    if (activeAssignments.length > 0) {
      if (!dto.reassignTo) {
        throw new ConflictException({
          message:
            'El psicólogo tiene pacientes activos: reasígnalos antes de desactivar la cuenta',
          patientIds: activeAssignments.map((a) => a.patientId),
        });
      }
      if (dto.reassignTo === id) {
        throw new BadRequestException(
          'No puedes reasignar pacientes al mismo psicólogo que se está desactivando',
        );
      }
      await this.reassignAll(activeAssignments, dto.reassignTo);
    }

    await this.userRepo.update(id, { accountStatus: 'suspended' });
  }

  async updateSedes(id: string, dto: UpdateSedesDto): Promise<void> {
    const psychologist = await this.userRepo.findOne({ where: { id, role: 'psychologist' } });
    if (!psychologist) throw new NotFoundException('Psicólogo no encontrado');

    const sedes = await this.sedeRepo.find({ where: { id: In(dto.sedeIds), isActive: true } });
    if (sedes.length !== dto.sedeIds.length) {
      throw new BadRequestException('Una o más sedes no existen o están inactivas');
    }

    const current = await this.psychSedeRepo.find({ where: { psychologistId: id } });
    const currentSedeIds = new Set(current.map((l) => l.sedeId));
    const nextSedeIds = new Set(dto.sedeIds);

    const toRemove = current.filter((l) => !nextSedeIds.has(l.sedeId));
    const toAdd = dto.sedeIds.filter((sedeId) => !currentSedeIds.has(sedeId));

    for (const link of toRemove) {
      const assignments = await this.assignmentRepo.find({
        where: { psychologistId: id, sedeId: link.sedeId, active: true },
      });
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
      await this.reassignAll(assignments, reassignTo);
    }

    if (toRemove.length > 0) {
      await this.psychSedeRepo.delete({ id: In(toRemove.map((l) => l.id)) });
    }
    if (toAdd.length > 0) {
      await this.psychSedeRepo.save(
        toAdd.map((sedeId) => this.psychSedeRepo.create({ psychologistId: id, sedeId })),
      );
    }
  }
}
