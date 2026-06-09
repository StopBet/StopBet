import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AiAssistantService } from './ai-assistant.service';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('ai-assistant')
@Controller('ai')
export class AiAssistantController {
  constructor(private readonly service: AiAssistantService) {}

  @Post('sessions')
  @ApiOperation({ summary: 'Inicia una nueva sesión con el asistente IA' })
  @ApiHeader({ name: 'x-user-id', description: 'UUID del paciente' })
  @ApiResponse({ status: 201, description: 'StartSessionResponse con mensaje de apertura' })
  startSession(@Headers('x-user-id') userId: string) {
    return this.service.startSession(userId);
  }

  @Get('sessions/active')
  @ApiOperation({ summary: 'Recupera la sesión activa del usuario (si existe)' })
  @ApiHeader({ name: 'x-user-id', description: 'UUID del paciente' })
  @ApiResponse({ status: 200, description: 'StartSessionResponse o null' })
  getActiveSession(@Headers('x-user-id') userId: string) {
    return this.service.getActiveSession(userId);
  }

  @Post('sessions/:sessionId/messages')
  @ApiOperation({ summary: 'Envía un mensaje al asistente y obtiene respuesta' })
  @ApiHeader({ name: 'x-user-id', description: 'UUID del paciente' })
  @ApiParam({ name: 'sessionId', description: 'UUID de la sesión activa' })
  @ApiResponse({ status: 201, description: 'SendMessageResponse con respuesta del asistente' })
  @ApiResponse({ status: 404, description: 'Sesión no encontrada o ya cerrada' })
  sendMessage(
    @Param('sessionId') sessionId: string,
    @Headers('x-user-id') userId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.service.sendMessage(sessionId, userId, dto);
  }

  @Post('sessions/:sessionId/close')
  @ApiOperation({ summary: 'Cierra la sesión y genera resumen clínico' })
  @ApiHeader({ name: 'x-user-id', description: 'UUID del paciente' })
  @ApiParam({ name: 'sessionId', description: 'UUID de la sesión' })
  @ApiResponse({ status: 201, description: 'AiSessionSummary generado por Gemini' })
  closeSession(
    @Param('sessionId') sessionId: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.service.closeSession(sessionId, userId);
  }

  @Get('sessions/summaries')
  @ApiOperation({ summary: 'Historial de resúmenes de sesiones del paciente (últimas 10)' })
  @ApiHeader({ name: 'x-user-id', description: 'UUID del paciente' })
  @ApiResponse({ status: 200, description: 'AiSessionSummary[]' })
  getSummaries(@Headers('x-user-id') userId: string) {
    return this.service.getSummaries(userId);
  }
}
