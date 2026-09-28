import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FamilyService } from './family.service';
import { CreateFamilyLinkDto } from './dto/create-family-link.dto';
import { CreateFamilySessionDto } from './dto/create-family-session.dto';
import { ConfirmAttendanceDto } from './dto/confirm-attendance.dto';
import { RegisterFamilyDto } from './dto/register-family.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '@stopbet/shared-types';

@ApiTags('family')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('family')
export class FamilyController {
  constructor(private readonly familyService: FamilyService) {}

  // Público: quien se registra todavía no tiene cuenta (HDU 22).
  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Registra la cuenta de un familiar declarando el RUT del paciente' })
  @ApiResponse({ status: 201, description: 'RegisterFamilyResponse — misma respuesta exista o no el paciente' })
  @ApiResponse({ status: 409, description: 'Ya existe una cuenta con ese correo o RUT' })
  register(@Body() dto: RegisterFamilyDto) {
    return this.familyService.registerFamily(dto);
  }

  // ── Vínculo ───────────────────────────────────────────────────────────────

  @Post('link')
  @Roles('family')
  @ApiOperation({ summary: 'Solicitar vinculación con un paciente' })
  @ApiResponse({ status: 201, description: 'Vínculo creado en estado pending' })
  requestLink(@CurrentUser() user: AuthUser, @Body() dto: CreateFamilyLinkDto) {
    return this.familyService.requestLink(user.id, dto);
  }

  @Get('link-status')
  @Roles('family')
  @ApiOperation({ summary: 'CA 11.6 — Estado del vínculo del familiar' })
  @ApiResponse({ status: 200, description: 'active | pending | unlinked' })
  getLinkStatus(@CurrentUser() user: AuthUser) {
    return this.familyService.getLinkStatus(user.id);
  }

  // ── Revisión del vínculo por el psicólogo (HDU 23) ──────────────────────────

  @Get('pending')
  @Roles('psychologist', 'coordinator')
  @ApiOperation({ summary: 'HDU 23 CA1 — Familiares pendientes de vinculación en mi sede' })
  @ApiResponse({ status: 200, description: 'FamilyLinkListItem[]' })
  listPendingLinks(@CurrentUser() user: AuthUser) {
    return this.familyService.listPendingLinks(user);
  }

  @Get('active')
  @Roles('psychologist', 'coordinator')
  @ApiOperation({ summary: 'HDU 23 CA5 — Familiares vinculados en mi sede (para poder revocar)' })
  @ApiResponse({ status: 200, description: 'FamilyLinkListItem[]' })
  listActiveLinks(@CurrentUser() user: AuthUser) {
    return this.familyService.listActiveLinks(user);
  }

  @Patch('links/:id/confirm')
  @Roles('psychologist', 'coordinator')
  @ApiOperation({ summary: 'HDU 23 CA2 — Confirmar el vínculo declarado por el familiar' })
  @ApiResponse({ status: 200, description: 'Vínculo confirmado — notifica a ambas partes' })
  @ApiResponse({ status: 409, description: 'El vínculo ya fue procesado' })
  confirmLink(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.familyService.confirmLink(id, user);
  }

  @Patch('links/:id/reject')
  @Roles('psychologist', 'coordinator')
  @ApiOperation({ summary: 'HDU 23 CA3 — Rechazar el vínculo declarado por el familiar' })
  @ApiResponse({ status: 200, description: 'Vínculo rechazado — notifica al familiar' })
  @ApiResponse({ status: 409, description: 'El vínculo ya fue procesado' })
  rejectLink(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.familyService.rejectLink(id, user);
  }

  @Patch('links/:id/revoke')
  @Roles('psychologist', 'coordinator')
  @ApiOperation({ summary: 'HDU 23 CA5 — Revocar un vínculo activo' })
  @ApiResponse({ status: 200, description: 'Acceso retirado de inmediato — notifica a ambas partes' })
  @ApiResponse({ status: 409, description: 'El vínculo no está activo' })
  revokeLink(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.familyService.revokeLink(id, user);
  }

  // ── Mensualidad ───────────────────────────────────────────────────────────

  @Get('billing')
  @Roles('family')
  @ApiOperation({ summary: 'Cuotas del paciente vinculado, para que el familiar las pague' })
  @ApiResponse({
    status: 200,
    description:
      'linkStatus, nombre de pila del paciente, cuotas vencidas con su total y la próxima ' +
      'cuota pendiente. Sin vínculo activo no trae cuotas.',
  })
  getBilling(@CurrentUser() user: AuthUser) {
    return this.familyService.getBillingForFamily(user.id);
  }

  // ── Sesiones ──────────────────────────────────────────────────────────────

  @Get('sessions')
  @Roles('family')
  @ApiOperation({ summary: 'CA 11.1 + 11.5 + 11.6 — Sesiones de la sede del paciente vinculado' })
  @ApiResponse({
    status: 200,
    description:
      'linkStatus (active | pending | unlinked), sesiones ordenadas por fecha más próxima ' +
      'y hasUpcoming (false si no hay ninguna en 4 semanas)',
  })
  getSessions(@CurrentUser() user: AuthUser) {
    return this.familyService.getSessionsForFamily(user.id);
  }

  @Post('sessions/:id/attendance')
  @Roles('family')
  @ApiOperation({ summary: 'CA 11.4 — Confirmar o rechazar asistencia a una sesión' })
  @ApiResponse({ status: 201, description: 'Confirmación registrada' })
  confirmAttendance(
    @CurrentUser() user: AuthUser,
    @Param('id') sessionId: string,
    @Body() dto: ConfirmAttendanceDto,
  ) {
    return this.familyService.confirmAttendance(user.id, sessionId, dto);
  }

  // CA 11.4 — sesiones de la sede del psicólogo con quién confirmó cada una.
  // Va antes de 'sessions/:id/attendance' para no depender de conocer un id.
  @Get('sede/sessions')
  @Roles('psychologist', 'coordinator')
  @ApiOperation({ summary: 'CA 11.4 — Sesiones de mi sede con las confirmaciones de familiares' })
  @ApiResponse({
    status: 200,
    description: 'Sesiones ordenadas por fecha, con confirmedCount, declinedCount y el detalle',
  })
  getSedeSessions(@CurrentUser() user: AuthUser) {
    // Una cuenta clínica sin sede es un error de configuración, no un estado
    // normal: devolver lista vacía lo haría pasar por "no hay sesiones".
    if (!user.sedeId) {
      throw new UnprocessableEntityException('Tu cuenta no tiene una sede asignada');
    }
    return this.familyService.getSedeSessions(user.sedeId);
  }

  // Psicólogo ve asistencias de una sesión (CA 11.4 segunda mitad)
  @Get('sessions/:id/attendance')
  @Roles('psychologist', 'coordinator')
  @ApiOperation({ summary: 'CA 11.4 — Ver asistencias de una sesión (psicólogo)' })
  getAttendances(@Param('id') sessionId: string) {
    return this.familyService.getAttendancesForSession(sessionId);
  }

  // Psicólogo/coordinador crea una sesión
  @Post('sessions')
  @Roles('psychologist', 'coordinator')
  @ApiOperation({ summary: 'Crear sesión grupal de familiares' })
  @ApiResponse({ status: 201, description: 'Sesión creada' })
  createSession(@Body() dto: CreateFamilySessionDto) {
    return this.familyService.createSession(dto);
  }
}
