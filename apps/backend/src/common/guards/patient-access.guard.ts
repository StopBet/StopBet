import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser } from '@stopbet/shared-types';
import { PatientAssignment } from '../../psychologists/entities/patient-assignment.entity';

// Endpoints del equipo clínico sobre UN paciente (`:patientId` o `:id` en la ruta).
// La coordinación accede a cualquiera; un psicólogo, solo a los que tiene asignados. Sin esto,
// un psicólogo leía las métricas o registraba una recaída de cualquier paciente con solo
// cambiar el id en la URL: el mismo problema que ya se cerró en la lista de pacientes.
//
// Va DESPUÉS de RolesGuard: @UseGuards(RolesGuard, PatientAccessGuard). Quién puede entrar
// lo decide @Roles(); este guard solo acota a qué pacientes.
@Injectable()
export class PatientAccessGuard implements CanActivate {
  constructor(
    @InjectRepository(PatientAssignment)
    private readonly assignmentRepo: Repository<PatientAssignment>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ user?: AuthUser; params: Record<string, string> }>();
    const user = req.user;
    const patientId = req.params.patientId ?? req.params.id;
    if (!user || !patientId) throw new ForbiddenException('No tienes acceso a este paciente');
    if (user.role === 'coordinator') return true;

    const asignado = await this.assignmentRepo.exists({
      where: { psychologistId: user.id, patientId, active: true },
    });
    // 403 y no 404: el paciente puede existir, lo que falta es la asignación.
    if (!asignado) throw new ForbiddenException('No tienes acceso a este paciente');
    return true;
  }
}
