import { Body, Controller, Get, Param, Post, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserId } from '../common/decorators/user-id.decorator';
import { AiAssistantService } from './ai-assistant.service';
import { SendMessageDto } from './dto/send-message.dto';
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
}
