import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '@stopbet/shared-types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserId } from '../common/decorators/user-id.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PatientAccessGuard } from '../common/guards/patient-access.guard';
import { ClinicalRecordsService } from './clinical-records.service';
import { SaveClinicalRecordDto } from './dto/save-clinical-record.dto';
import { CreateClinicalNoteDto } from './dto/create-clinical-note.dto';

// CA5: la ficha clínica no se alcanza cambiando el id en la URL. `RolesGuard` deja entrar solo
// al equipo clínico y `PatientAccessGuard` acota a qué pacientes: un psicólogo llega a los que
// tiene asignados y la coordinación a todos.
//
// El CA habla de "una sede distinta a la suya", y la asignación es más estricta que la sede
// —un psicólogo de la misma sede sin asignación tampoco entra—, así que cumple el criterio por
// arriba. Se prefirió a comparar sedes porque `users.sedeId` guarda a veces el nombre y a veces
// el UUID (ver CLAUDE.md): un filtro por sede fallaría en silencio, dejando fuera a pacientes
// legítimos sin que nada lo delate.
@ApiTags('clinical-records')
@ApiBearerAuth()
@Controller('clinical-records')
@Roles('psychologist', 'coordinator')
export class ClinicalRecordsController {
  constructor(private readonly service: ClinicalRecordsService) {}

  // Sin `PatientAccessGuard`: no hay un paciente en la ruta. El alcance lo resuelve el
  // servicio con la asignación, igual que `GET /users/patients`.
  @Get('status')
  @UseGuards(RolesGuard)
  @ApiOperation({
    summary: 'Qué pacientes ya tienen ficha, para marcar en la lista a quién le falta',
  })
  @ApiResponse({ status: 200, description: 'ClinicalRecordStatus[]' })
  status(@CurrentUser() user: AuthUser) {
    return this.service.getStatusFor(user);
  }

  @Get('patients/:patientId')
  @UseGuards(RolesGuard, PatientAccessGuard)
  @ApiOperation({
    summary: 'Ficha clínica del paciente; vacía y lista para completar si aún no existe',
  })
  @ApiResponse({ status: 200, description: 'ClinicalRecordView' })
  @ApiResponse({ status: 403, description: 'El paciente no está asignado a quien pregunta' })
  get(@Param('patientId') patientId: string) {
    return this.service.getForPatient(patientId);
  }

  @Put('patients/:patientId')
  @UseGuards(RolesGuard, PatientAccessGuard)
  @ApiOperation({ summary: 'Crea o actualiza la ficha y registra la versión para auditoría' })
  @ApiResponse({ status: 200, description: 'ClinicalRecord guardada' })
  @ApiResponse({ status: 400, description: 'Falta algún campo obligatorio' })
  @ApiResponse({ status: 403, description: 'El paciente no está asignado a quien pregunta' })
  save(
    @Param('patientId') patientId: string,
    @Body() dto: SaveClinicalRecordDto,
    @UserId() authorId: string,
  ) {
    return this.service.save(patientId, dto, authorId);
  }

  @Get('patients/:patientId/intake')
  @UseGuards(RolesGuard, PatientAccessGuard)
  @ApiOperation({ summary: 'Lo que el paciente declaró al registrarse; solo lectura' })
  @ApiResponse({ status: 200, description: 'IntakeView' })
  @ApiResponse({ status: 403, description: 'El paciente no está asignado a quien pregunta' })
  intake(@Param('patientId') patientId: string) {
    return this.service.getIntake(patientId);
  }

  // Las anotaciones cuelgan del paciente, no de la ficha: se puede anotar antes de que exista
  // la entrevista de ingreso. Por eso no devuelven 404 cuando todavía no hay ficha.
  @Get('patients/:patientId/notes')
  @UseGuards(RolesGuard, PatientAccessGuard)
  @ApiOperation({ summary: 'Anotaciones del seguimiento, de la más reciente a la más antigua' })
  @ApiResponse({ status: 200, description: 'ClinicalNote[]' })
  @ApiResponse({ status: 403, description: 'El paciente no está asignado a quien pregunta' })
  notes(@Param('patientId') patientId: string) {
    return this.service.getNotes(patientId);
  }

  @Post('patients/:patientId/notes')
  @UseGuards(RolesGuard, PatientAccessGuard)
  @ApiOperation({ summary: 'Agrega una anotación; no se puede editar ni borrar después' })
  @ApiResponse({ status: 201, description: 'ClinicalNote creada' })
  @ApiResponse({ status: 400, description: 'La anotación viene vacía' })
  @ApiResponse({ status: 403, description: 'El paciente no está asignado a quien pregunta' })
  addNote(
    @Param('patientId') patientId: string,
    @Body() dto: CreateClinicalNoteDto,
    @UserId() authorId: string,
  ) {
    return this.service.addNote(patientId, dto.content, authorId);
  }

  @Get('patients/:patientId/history')
  @UseGuards(RolesGuard, PatientAccessGuard)
  @ApiOperation({ summary: 'Historial de cambios de la ficha, del más reciente al más antiguo' })
  @ApiResponse({ status: 200, description: 'ClinicalRecordVersion[]' })
  @ApiResponse({ status: 403, description: 'El paciente no está asignado a quien pregunta' })
  @ApiResponse({ status: 404, description: 'El paciente todavía no tiene ficha' })
  history(@Param('patientId') patientId: string) {
    return this.service.getHistory(patientId);
  }
}
