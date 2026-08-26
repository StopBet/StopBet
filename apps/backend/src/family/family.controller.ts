import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FamilyService } from './family.service';
import { CreateFamilyLinkDto } from './dto/create-family-link.dto';
import { CreateFamilySessionDto } from './dto/create-family-session.dto';
import { ConfirmAttendanceDto } from './dto/confirm-attendance.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '@stopbet/shared-types';

@ApiTags('family')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('family')
export class FamilyController {
  constructor(private readonly familyService: FamilyService) {}

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
