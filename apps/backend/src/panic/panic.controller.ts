import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PanicService } from './panic.service';
import { AssignSponsorDto } from './dto/assign-sponsor.dto';

@ApiTags('panic')
@Controller('panic')
export class PanicController {
  constructor(private readonly service: PanicService) {}

  // ── Sponsor ────────────────────────────────────────────────────────────

  @Get('sponsor')
  @ApiOperation({ summary: 'Info del padrino asignado al paciente' })
  @ApiHeader({ name: 'x-user-id', description: 'UUID del paciente' })
  @ApiResponse({ status: 200, description: 'SponsorInfo | null' })
  getSponsorInfo(@Headers('x-user-id') userId: string) {
    return this.service.getSponsorInfo(userId);
  }

  @Post('assign')
  @HttpCode(204)
  @ApiOperation({ summary: 'Asignar padrino a un paciente (psicólogo)' })
  @ApiResponse({ status: 204, description: 'Asignación actualizada' })
  assignSponsor(@Body() dto: AssignSponsorDto) {
    return this.service.assignSponsor(dto);
  }

  // ── Alertas ────────────────────────────────────────────────────────────

  @Post('alerts')
  @HttpCode(201)
  @ApiOperation({ summary: 'Activar alerta de pánico (hold 2 s en mobile)' })
  @ApiHeader({ name: 'x-user-id', description: 'UUID del paciente' })
  @ApiResponse({ status: 201, description: 'PanicAlertDto' })
  @ApiResponse({ status: 404, description: 'Sin padrino asignado' })
  createAlert(@Headers('x-user-id') patientId: string) {
    return this.service.createAlert(patientId);
  }

  @Get('alerts/active')
  @ApiOperation({ summary: 'Alerta activa del usuario (polling cada 5 s)' })
  @ApiHeader({ name: 'x-user-id', description: 'UUID del paciente o del padrino' })
  @ApiResponse({ status: 200, description: 'ActiveAlertResponse' })
  getActiveAlert(@Headers('x-user-id') userId: string) {
    return this.service.getActiveAlert(userId);
  }

  @Get('pending')
  @ApiOperation({ summary: 'Alertas pendientes del padrino (polling)' })
  @ApiHeader({ name: 'x-user-id', description: 'UUID del padrino' })
  @ApiResponse({ status: 200, description: 'PanicAlertDto[]' })
  getPendingAlerts(@Headers('x-user-id') sponsorId: string) {
    return this.service.getPendingAlerts(sponsorId);
  }

  @Post('alerts/:id/respond')
  @HttpCode(200)
  @ApiOperation({ summary: 'Padrino confirma que atenderá al paciente' })
  @ApiHeader({ name: 'x-user-id', description: 'UUID del padrino' })
  @ApiParam({ name: 'id', description: 'UUID de la alerta' })
  @ApiResponse({ status: 200, description: 'PanicAlertDto actualizado' })
  @ApiResponse({ status: 404, description: 'Alerta no encontrada' })
  respond(@Param('id') id: string, @Headers('x-user-id') sponsorId: string) {
    return this.service.respond(id, sponsorId);
  }

  @Post('alerts/:id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Paciente cancela la alerta' })
  @ApiHeader({ name: 'x-user-id', description: 'UUID del paciente' })
  @ApiParam({ name: 'id', description: 'UUID de la alerta' })
  @ApiResponse({ status: 200, description: 'PanicAlertDto actualizado' })
  @ApiResponse({ status: 404, description: 'Alerta no encontrada o ya cerrada' })
  cancel(@Param('id') id: string, @Headers('x-user-id') patientId: string) {
    return this.service.cancel(id, patientId);
  }

  @Post('alerts/:id/escalate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Escalar alerta al asistente IA (manual o automático)' })
  @ApiHeader({ name: 'x-user-id', description: 'UUID del paciente' })
  @ApiParam({ name: 'id', description: 'UUID de la alerta' })
  @ApiResponse({ status: 200, description: 'PanicAlertDto actualizado' })
  escalate(@Param('id') id: string, @Headers('x-user-id') patientId: string) {
    return this.service.escalate(id, patientId);
  }

  @Post('alerts/:id/community')
  @HttpCode(200)
  @ApiOperation({ summary: 'Notificar a la comunidad de la sede del paciente' })
  @ApiHeader({ name: 'x-user-id', description: 'UUID del paciente' })
  @ApiParam({ name: 'id', description: 'UUID de la alerta' })
  @ApiResponse({ status: 200, description: '{ communityNotified: true }' })
  notifyCommunity(@Param('id') id: string, @Headers('x-user-id') patientId: string) {
    return this.service.notifyCommunity(id, patientId);
  }
}
