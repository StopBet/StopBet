import { Body, Controller, Get, Param, Patch, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { UserId } from '../common/decorators/user-id.decorator';
import { PatientAccessGuard } from '../common/guards/patient-access.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AiAssistantService } from './ai-assistant.service';
import { SendMessageDto } from './dto/send-message.dto';
import { SessionFeedbackDto } from './dto/session-feedback.dto';
import { LatencyInterceptor } from './latency.interceptor';

@ApiTags('ai-assistant')
@ApiBearerAuth()
@Controller('ai')
export class AiAssistantController {
  constructor(private readonly service: AiAssistantService) {}

  @Post('sessions')
  @ApiOperation({ summary: 'Inicia una nueva sesión con el asistente IA' })
  @ApiResponse({ status: 201, description: 'StartSessionResponse con mensaje de apertura' })
  startSession(@UserId() userId: string) {
    return this.service.startSession(userId);
  }

  @Get('sessions/active')
  @ApiOperation({ summary: 'Recupera la sesión activa del usuario (si existe)' })
  @ApiResponse({ status: 200, description: 'StartSessionResponse o null' })
  getActiveSession(@UserId() userId: string) {
    return this.service.getActiveSession(userId);
  }

  @Post('sessions/:sessionId/messages')
  @UseInterceptors(LatencyInterceptor)
  @ApiOperation({ summary: 'Envía un mensaje al asistente y obtiene respuesta' })
  @ApiParam({ name: 'sessionId', description: 'UUID de la sesión activa' })
  @ApiResponse({ status: 201, description: 'SendMessageResponse con respuesta del asistente' })
  @ApiResponse({ status: 404, description: 'Sesión no encontrada o ya cerrada' })
  sendMessage(
    @Param('sessionId') sessionId: string,
    @UserId() userId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.service.sendMessage(sessionId, userId, dto);
  }

  @Post('sessions/:sessionId/close')
  @ApiOperation({ summary: 'Cierra la sesión y genera resumen clínico' })
  @ApiParam({ name: 'sessionId', description: 'UUID de la sesión' })
  @ApiResponse({ status: 201, description: 'AiSessionSummary generado por Gemini' })
  closeSession(
    @Param('sessionId') sessionId: string,
    @UserId() userId: string,
  ) {
    return this.service.closeSession(sessionId, userId);
  }

  @Get('sessions/summaries')
  @ApiOperation({ summary: 'Historial de resúmenes de sesiones del paciente (últimas 10)' })
  @ApiResponse({ status: 200, description: 'AiSessionSummary[]' })
  getSummaries(@UserId() userId: string) {
    return this.service.getSummaries(userId);
  }

  @Patch('sessions/:sessionId/feedback')
  @ApiOperation({ summary: 'HdU10: el paciente dice si la conversación le ayudó' })
  @ApiParam({ name: 'sessionId', description: 'UUID de la sesión ya cerrada' })
  @ApiResponse({ status: 200, description: 'AiSessionHistoryItem' })
  @ApiResponse({ status: 404, description: 'La sesión no existe o no es del paciente' })
  setFeedback(
    @Param('sessionId') sessionId: string,
    @UserId() userId: string,
    @Body() dto: SessionFeedbackDto,
  ) {
    return this.service.setFeedback(sessionId, userId, dto.feedback);
  }

  // CA4: el compañero de viaje y el familiar no son equipo clínico, así que `RolesGuard` los
  // deja fuera; `PatientAccessGuard` acota al psicólogo a sus pacientes asignados.
  @Get('patients/:patientId/summaries')
  @Roles('psychologist', 'coordinator')
  @UseGuards(RolesGuard, PatientAccessGuard)
  @ApiOperation({ summary: 'HdU10: historial de conversaciones del paciente para su equipo clínico' })
  @ApiResponse({ status: 200, description: 'AiSessionClinicalItem[]' })
  @ApiResponse({ status: 403, description: 'No es equipo clínico o no tiene a ese paciente' })
  getPatientSummaries(@Param('patientId') patientId: string) {
    return this.service.getPatientSummaries(patientId);
  }
}
