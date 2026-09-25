import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserId } from '../common/decorators/user-id.decorator';
import { PanicService } from './panic.service';
import { AssignSponsorDto } from './dto/assign-sponsor.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('panic')
@ApiBearerAuth()
@Controller('panic')
export class PanicController {
  constructor(private readonly service: PanicService) {}

  // ── Sponsor ────────────────────────────────────────────────────────────

  @Get('sponsor')
  @ApiOperation({ summary: 'Info del padrino asignado al paciente' })
  @ApiResponse({ status: 200, description: 'SponsorInfo | null' })
  getSponsorInfo(@UserId() userId: string) {
    return this.service.getSponsorInfo(userId);
  }

  // Antes no pedía ninguna identidad: cualquiera en internet podía cambiarle el compañero de
  // viaje a cualquier paciente.
  @Post('assign')
  @UseGuards(RolesGuard)
  @Roles('psychologist', 'coordinator')
  @HttpCode(204)
  @ApiOperation({ summary: 'Asignar padrino a un paciente (psicólogo)' })
  @ApiResponse({ status: 204, description: 'Asignación actualizada' })
  @ApiResponse({ status: 403, description: 'Rol sin permiso para asignar' })
  assignSponsor(@Body() dto: AssignSponsorDto) {
    return this.service.assignSponsor(dto);
  }

  // ── Alertas ────────────────────────────────────────────────────────────

  @Post('alerts')
  @HttpCode(201)
  @ApiOperation({ summary: 'Activar alerta de pánico (hold 2 s en mobile)' })
  @ApiResponse({ status: 201, description: 'PanicAlertDto' })
  @ApiResponse({ status: 404, description: 'Sin padrino asignado' })
  createAlert(@UserId() patientId: string) {
    return this.service.createAlert(patientId);
  }

  // Expone el nombre del paciente y su historial de crisis: sin guard quedaba
  // abierto a cualquiera que supiera la URL. Solo lo consume el dashboard web,
  // que ya manda Authorization: Bearer.
  @Get('alerts/history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('psychologist', 'coordinator')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Historial completo de alertas de pánico (vista psicólogo)' })
  @ApiResponse({ status: 200, description: 'Lista de todas las alertas con nombre del paciente' })
  @ApiResponse({ status: 401, description: 'Sin token' })
  @ApiResponse({ status: 403, description: 'Rol sin permiso' })
  listHistory() {
    return this.service.listHistory();
  }

  @Get('alerts/active')
  @ApiOperation({ summary: 'Alerta activa del usuario (polling cada 5 s)' })
  @ApiResponse({ status: 200, description: 'ActiveAlertResponse' })
  getActiveAlert(@UserId() userId: string) {
    return this.service.getActiveAlert(userId);
  }

  @Get('pending')
  @ApiOperation({ summary: 'Alertas pendientes del padrino (polling)' })
  @ApiResponse({ status: 200, description: 'PanicAlertDto[]' })
  getPendingAlerts(@UserId() sponsorId: string) {
    return this.service.getPendingAlerts(sponsorId);
  }

  @Post('alerts/:id/respond')
  @HttpCode(200)
  @ApiOperation({ summary: 'Padrino confirma que atenderá al paciente' })
  @ApiParam({ name: 'id', description: 'UUID de la alerta' })
  @ApiResponse({ status: 200, description: 'PanicAlertDto actualizado' })
  @ApiResponse({ status: 404, description: 'Alerta no encontrada' })
  respond(@Param('id') id: string, @UserId() sponsorId: string) {
    return this.service.respond(id, sponsorId);
  }

  @Delete('alerts/active')
  @HttpCode(200)
  @ApiOperation({ summary: '[DEMO] Cancela cualquier alerta activa del usuario' })
  @ApiResponse({ status: 200, description: '{ cancelled: boolean }' })
  cancelActive(@UserId() patientId: string) {
    return this.service.cancelActiveAlert(patientId);
  }

  @Post('alerts/:id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Paciente cancela la alerta' })
  @ApiParam({ name: 'id', description: 'UUID de la alerta' })
  @ApiResponse({ status: 200, description: 'PanicAlertDto actualizado' })
  @ApiResponse({ status: 404, description: 'Alerta no encontrada o ya cerrada' })
  cancel(@Param('id') id: string, @UserId() patientId: string) {
    return this.service.cancel(id, patientId);
  }

  @Post('alerts/:id/escalate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Escalar alerta al asistente IA (manual o automático)' })
  @ApiParam({ name: 'id', description: 'UUID de la alerta' })
  @ApiResponse({ status: 200, description: 'PanicAlertDto actualizado' })
  escalate(@Param('id') id: string, @UserId() patientId: string) {
    return this.service.escalate(id, patientId);
  }

  @Post('alerts/:id/community')
  @HttpCode(200)
  @ApiOperation({ summary: 'Notificar a la comunidad de la sede del paciente' })
  @ApiParam({ name: 'id', description: 'UUID de la alerta' })
  @ApiResponse({ status: 200, description: '{ communityNotified: true }' })
  notifyCommunity(@Param('id') id: string, @UserId() patientId: string) {
    return this.service.notifyCommunity(id, patientId);
  }
}
