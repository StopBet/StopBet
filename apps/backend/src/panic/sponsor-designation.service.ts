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
import { SponsorDesignation } from './entities/sponsor-designation.entity';

@Injectable()
export class SponsorDesignationService {
  constructor(
    @InjectRepository(SponsorDesignation)
    private readonly designationRepo: Repository<SponsorDesignation>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

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
        'Solo un paciente puede ser designado como padrino',
      );
    }
    if (patient.accountStatus !== 'active') {
      throw new BadRequestException(
        'La cuenta del paciente no está activa',
      );
    }
    // Mismo criterio que el listado: el psicólogo decide dentro de su sede.
    if (actor.sedeId && patient.sedeId !== actor.sedeId) {
      throw new ForbiddenException('El paciente no pertenece a tu sede');
    }

    const existing = await this.designationRepo.findOne({
      where: { patientId, isActive: true },
    });
    if (existing) {
      throw new ConflictException('El paciente ya es padrino');
    }

    const saved = await this.designationRepo.save(
      this.designationRepo.create({
        patientId,
        designatedBy: actor.id,
        isActive: true,
      }),
    );

    return this.serialize(saved, patient, actor);
  }

  private serialize(
    designation: SponsorDesignation,
    patient: User,
    actor: AuthUser,
  ): SponsorDesignationDto {
    return {
      id: designation.id,
      patientId: designation.patientId,
      patientName: `${patient.firstName} ${patient.lastName}`,
      designatedBy: designation.designatedBy,
      designatedByName: `${actor.firstName} ${actor.lastName}`,
      designatedAt: designation.designatedAt.toISOString(),
      isActive: designation.isActive,
      revokedAt: designation.revokedAt?.toISOString() ?? null,
    };
  }
}
