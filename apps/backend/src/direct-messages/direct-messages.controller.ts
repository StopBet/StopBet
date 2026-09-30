import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  MessageEvent,
  Param,
  Post,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Observable, map, merge, timer } from 'rxjs';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserId } from '../common/decorators/user-id.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ParseDbUuidPipe } from '../common/pipes/parse-db-uuid.pipe';
import { DirectMessagesService } from './direct-messages.service';
import { SendDirectMessageDto } from './dto/send-direct-message.dto';
import { ReportDirectMessageDto } from './dto/report-direct-message.dto';

// Railway y los proxies cortan las conexiones ociosas bastante antes del minuto.
const LATIDO_MS = 25_000;

/**
 * Mensajes directos entre personas de la misma sede.
 *
 * Son **privados**: el equipo clínico no lee las conversaciones. Lo único que le llega es un
 * mensaje que alguien reportó, por la cola de moderación de la comunidad (decisión del PO del
 * 30-09).
 */
@ApiTags('direct-messages')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('patient', 'sponsor')
@Controller('messages')
export class DirectMessagesController {
  constructor(private readonly service: DirectMessagesService) {}

  @Sse('stream')
  @ApiOperation({ summary: 'Mensajes directos propios, en vivo (SSE)' })
  @ApiResponse({ status: 200, description: 'DirectStreamEvent por cada mensaje que recibe o envía' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido' })
  stream(@UserId() userId: string): Observable<MessageEvent> {
    const latido$ = timer(LATIDO_MS, LATIDO_MS).pipe(map(() => ({ kind: 'ping' as const })));
    return merge(this.service.observarUsuario(userId), latido$).pipe(map((data) => ({ data })));
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Lista de chats: las conversaciones con al menos un mensaje' })
  @ApiResponse({ status: 200, description: 'DirectConversationSummary[], la más reciente primero' })
  listConversations(@UserId() userId: string) {
    return this.service.listConversations(userId);
  }

  @Get('contacts')
  @ApiOperation({ summary: 'Personas de la sede a las que se les puede escribir' })
  @ApiQuery({ name: 'q', required: false, description: 'Parte del nombre, sin importar tildes' })
  @ApiResponse({ status: 200, description: 'DirectContact[] (máximo 50)' })
  findContacts(@UserId() userId: string, @Query('q') q?: string) {
    return this.service.findContacts(userId, q);
  }

  @Get('with/:userId')
  @ApiOperation({ summary: 'Conversación con una persona (paginada, la más nueva primero)' })
  @ApiParam({ name: 'userId', description: 'UUID de la otra persona' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 30 })
  @ApiResponse({ status: 200, description: 'DirectThread' })
  @ApiResponse({ status: 404, description: 'No existe o no es de la misma sede' })
  getThread(
    @UserId() userId: string,
    @Param('userId', ParseDbUuidPipe) otherId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 30,
  ) {
    return this.service.getThread(userId, otherId, Math.max(1, Number(page) || 1), Math.min(100, Math.max(1, Number(limit) || 30)));
  }

  @Post('with/:userId')
  @HttpCode(201)
  @ApiOperation({ summary: 'Envía un mensaje directo (crea la conversación si no existe)' })
  @ApiParam({ name: 'userId', description: 'UUID de quien recibe' })
  @ApiResponse({ status: 201, description: 'DirectMessage creado (o el original, si es un reintento)' })
  @ApiResponse({ status: 403, description: 'Hay un bloqueo entre las dos personas' })
  @ApiResponse({ status: 404, description: 'No existe o no es de la misma sede' })
  send(
    @UserId() userId: string,
    @Param('userId', ParseDbUuidPipe) otherId: string,
    @Body() dto: SendDirectMessageDto,
  ) {
    return this.service.send(userId, otherId, dto);
  }

  @Post('with/:userId/read')
  @HttpCode(200)
  @ApiOperation({ summary: 'Marca como leída la conversación con esa persona' })
  @ApiParam({ name: 'userId', description: 'UUID de la otra persona' })
  @ApiResponse({ status: 200, description: '{ read: true }' })
  markRead(@UserId() userId: string, @Param('userId', ParseDbUuidPipe) otherId: string) {
    return this.service.markRead(userId, otherId);
  }

  @Post(':id/report')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reporta un mensaje recibido; llega a la cola de moderación' })
  @ApiParam({ name: 'id', description: 'UUID del mensaje' })
  @ApiResponse({ status: 200, description: '{ reported: true }' })
  @ApiResponse({ status: 404, description: 'Mensaje no encontrado' })
  report(
    @UserId() userId: string,
    @Param('id', ParseDbUuidPipe) id: string,
    @Body() dto: ReportDirectMessageDto,
  ) {
    return this.service.report(userId, id, dto.reason);
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Elimina un mensaje propio para las dos personas' })
  @ApiParam({ name: 'id', description: 'UUID del mensaje' })
  @ApiResponse({ status: 200, description: '{ deleted: true }' })
  @ApiResponse({ status: 403, description: 'El mensaje no es propio' })
  @ApiResponse({ status: 404, description: 'Mensaje no encontrado' })
  deleteOwn(@UserId() userId: string, @Param('id', ParseDbUuidPipe) id: string) {
    return this.service.deleteOwn(userId, id);
  }

  @Post('blocks/:userId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Bloquea a una persona: ninguna de las dos puede escribirle a la otra' })
  @ApiParam({ name: 'userId', description: 'UUID de la persona' })
  @ApiResponse({ status: 200, description: '{ blocked: true }' })
  block(@UserId() userId: string, @Param('userId', ParseDbUuidPipe) otherId: string) {
    return this.service.block(userId, otherId);
  }

  @Delete('blocks/:userId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Desbloquea a una persona' })
  @ApiParam({ name: 'userId', description: 'UUID de la persona' })
  @ApiResponse({ status: 200, description: '{ blocked: false }' })
  unblock(@UserId() userId: string, @Param('userId', ParseDbUuidPipe) otherId: string) {
    return this.service.unblock(userId, otherId);
  }
}
