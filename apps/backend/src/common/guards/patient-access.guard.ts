import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuthUser, PatientAccessDenial } from '@stopbet/shared-types';
import { PatientAssignment } from '../../psychologists/entities/patient-assignment.entity';
import { PsychologistSede } from '../../psychologists/entities/psychologist-sede.entity';
import { formasDeSede, formasDeSedesDeUsuario } from '../../psychologists/sedes-of-user';
import { Sede } from '../../sedes/entities/sede.entity';
import { User } from '../../users/entities/user.entity';

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
    // DataSource y no tres @InjectRepository más: el guard se usa en seis módulos y cada uno
    // tendría que registrar User, Sede y PsychologistSede solo para que esto compile.
    private readonly dataSource: DataSource,
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
    if (!asignado) throw await this.denegar(user, patientId);
    return true;
  }

  // HdU13 CA5: decirle al psicólogo si el paciente es de otra sede o es de la suya pero no lo
  // tiene asignado, porque lo que tiene que hacer en cada caso es distinto. Un id que no es de
  // ningún paciente recibe el mensaje genérico, para que la URL no sirva para averiguar quién
  // es paciente.
  private async denegar(user: AuthUser, patientId: string): Promise<ForbiddenException> {
    const generico = new ForbiddenException('No tienes acceso a este paciente');

    const patient = await this.dataSource
      .getRepository(User)
      .findOne({ where: { id: patientId, role: 'patient' }, select: ['id', 'sedeId'] })
      .catch(() => null); // un id que no es UUID hace fallar la query: es lo mismo que no existir
    if (!patient?.sedeId) return generico;

    const sedeRepo = this.dataSource.getRepository(Sede);
    const [mias, delPaciente] = await Promise.all([
      formasDeSedesDeUsuario(sedeRepo, this.dataSource.getRepository(PsychologistSede), user),
      formasDeSede(sedeRepo, patient.sedeId),
    ]);
    const reason: PatientAccessDenial = delPaciente.some((s) => mias.has(s))
      ? 'not_assigned'
      : 'other_sede';

    return new ForbiddenException({
      statusCode: 403,
      error: 'Forbidden',
      reason,
      message:
        reason === 'other_sede'
          ? 'Este paciente no es de tu sede'
          : 'Este paciente no está asignado a ti',
    });
  }
}
