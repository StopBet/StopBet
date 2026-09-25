import {
  BadRequestException,
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
import { AuthUser, ReactionEmoji } from '@stopbet/shared-types';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CommunityService } from './community.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateReplyDto } from './dto/create-reply.dto';
import { AddReactionDto } from './dto/add-reaction.dto';
import { ReportPostDto } from './dto/report-post.dto';

// Railway y los proxies cortan las conexiones ociosas bastante antes del minuto.
const LATIDO_MS = 25_000;

@ApiTags('community')
@ApiBearerAuth()
@Controller('community')
export class CommunityController {
  constructor(private readonly service: CommunityService) {}

  // ── Anuncios ────────────────────────────────────────────────────────────

  @Get('announcements')
  @ApiOperation({ summary: 'Lista anuncios de una sede AJUTER' })
  @ApiQuery({ name: 'sede', description: 'Sede (Santiago | Viña del Mar | Concepción)' })
  @ApiResponse({ status: 200, description: 'Array de anuncios con estado de asistencia' })
  findAnnouncements(
    @UserId() userId: string,
    @Query('sede') sede: string,
  ) {
    return this.service.findAnnouncements(sede, userId);
  }

  // Un anuncio llega a toda la sede con el nombre y el rol del autor arriba. Sin guard,
  // cualquiera que supiera la URL podía publicar uno firmado como el equipo clínico. El
  // autor sale del token, no del header: mandar el `x-user-id` de otro ya no sirve.
  @Post('announcements')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('psychologist', 'coordinator')
  @ApiBearerAuth()
  @HttpCode(201)
  @ApiOperation({ summary: 'Crea un anuncio (psicólogo o coordinador)' })
  @ApiResponse({ status: 201, description: 'Anuncio creado' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido' })
  @ApiResponse({ status: 403, description: 'Solo el equipo clínico puede publicar anuncios' })
  createAnnouncement(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateAnnouncementDto,
  ) {
    return this.service.createAnnouncement(dto, user.id);
  }

  @Post('announcements/:id/attend')
  @HttpCode(200)
  @ApiOperation({ summary: 'Confirmar o cancelar asistencia a un evento (toggle)' })
  @ApiParam({ name: 'id', description: 'UUID del anuncio' })
  @ApiResponse({ status: 200, description: '{ attends: boolean }' })
  @ApiResponse({ status: 404, description: 'Anuncio no encontrado' })
  toggleAttendance(
    @Param('id') id: string,
    @UserId() userId: string,
  ) {
    return this.service.toggleAttendance(id, userId);
  }

  // ── Foro ────────────────────────────────────────────────────────────────

  // El mensaje viaja dentro del evento, así que el stream **exige token** como cualquier
  // otro endpoint: en el navegador `EventSource` no puede mandar cabeceras, pero el cliente
  // de la app sí, y acá no entra nadie sin sesión.
  @Sse('stream')
  @ApiOperation({ summary: 'Mensajes del foro de una sede, en vivo (SSE)' })
  @ApiQuery({ name: 'sede', description: 'Sede (Santiago | Viña del Mar | Concepción)' })
  @ApiResponse({ status: 200, description: 'CommunityStreamEvent por cada mensaje nuevo' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido' })
  async stream(@Query('sede') sede: string): Promise<Observable<MessageEvent>> {
    const mensajes$ = await this.service.observarSede(sede);
    // Un proxy corta una conexión que no dice nada. El latido la mantiene viva y no
    // cuesta: es un evento cada 25 s por cliente, sin tocar la base.
    const latido$ = timer(LATIDO_MS, LATIDO_MS).pipe(
      map(() => ({ kind: 'ping' as const })),
    );
    return merge(mensajes$, latido$).pipe(map((data) => ({ data })));
  }


  @Get('posts')
  @ApiOperation({ summary: 'Lista publicaciones del foro por sede (paginado)' })
  @ApiQuery({ name: 'sede', description: 'Sede (Santiago | Viña del Mar | Concepción)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'PaginatedResponse<CommunityPost>' })
  findPosts(
    @UserId() userId: string,
    @Query('sede') sede: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.service.findPosts(sede, Number(page), Number(limit), userId);
  }

  // El foro es un espacio entre pares: abrir tema es del paciente y su compañero de viaje. El
  // equipo clínico acompaña respondiendo y publica sus avisos como anuncio, que va firmado con
  // el rol. Sin `@Roles` cualquier sesión podía abrir una publicación en el foro.
  @Post('posts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('patient', 'sponsor')
  @HttpCode(201)
  @ApiOperation({ summary: 'Publica un mensaje en el foro comunitario (paciente o compañero de viaje)' })
  @ApiResponse({ status: 201, description: 'Publicación creada' })
  @ApiResponse({ status: 403, description: 'El equipo clínico no abre publicaciones: responde o publica un anuncio' })
  createPost(
    @UserId() authorId: string,
    @Body() dto: CreatePostDto,
  ) {
    return this.service.createPost(dto, authorId);
  }

  @Post('posts/:id/reactions')
  @HttpCode(200)
  @ApiOperation({ summary: 'Agrega una reacción emoji a una publicación (idempotente)' })
  @ApiParam({ name: 'id', description: 'UUID de la publicación' })
  @ApiResponse({ status: 200, description: 'Resumen actualizado de reacciones' })
  @ApiResponse({ status: 404, description: 'Publicación no encontrada' })
  addReaction(
    @Param('id') id: string,
    @UserId() userId: string,
    @Body() dto: AddReactionDto,
  ) {
    return this.service.addReaction(id, dto.emoji as ReactionEmoji, userId);
  }

  @Delete('posts/:id/reactions/:emoji')
  @HttpCode(200)
  @ApiOperation({ summary: 'Elimina una reacción emoji de una publicación' })
  @ApiParam({ name: 'id', description: 'UUID de la publicación' })
  @ApiParam({ name: 'emoji', description: 'Emoji url-encoded (%F0%9F%92%AA para 💪)' })
  @ApiResponse({ status: 200, description: 'Resumen actualizado de reacciones' })
  @ApiResponse({ status: 400, description: 'Emoji inválido' })
  removeReaction(
    @Param('id') id: string,
    @Param('emoji') emoji: string,
    @UserId() userId: string,
  ) {
    const VALID_EMOJIS: ReactionEmoji[] = ['💪', '❤️', '🤗'];
    if (!VALID_EMOJIS.includes(emoji as ReactionEmoji)) {
      throw new BadRequestException('Emoji inválido');
    }
    return this.service.removeReaction(id, emoji as ReactionEmoji, userId);
  }

  @Get('posts/:id/replies')
  @ApiOperation({ summary: 'Lista respuestas de una publicación (orden ASC)' })
  @ApiParam({ name: 'id', description: 'UUID de la publicación' })
  @ApiResponse({ status: 200, description: 'CommunityReply[]' })
  @ApiResponse({ status: 404, description: 'Publicación no encontrada' })
  findReplies(@Param('id') id: string) {
    return this.service.findReplies(id);
  }

  @Post('posts/:id/replies')
  @HttpCode(201)
  @ApiOperation({ summary: 'Responde a una publicación del foro' })
  @ApiParam({ name: 'id', description: 'UUID de la publicación' })
  @ApiResponse({ status: 201, description: 'Respuesta creada' })
  @ApiResponse({ status: 403, description: 'La publicación es de otra sede' })
  @ApiResponse({ status: 404, description: 'Publicación no encontrada' })
  createReply(
    @Param('id') id: string,
    @UserId() authorId: string,
    @Body() dto: CreateReplyDto,
  ) {
    return this.service.createReply(id, dto, authorId);
  }

  @Post('posts/:id/report')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reporta una publicación con un motivo (máx 1 reporte por usuario)' })
  @ApiParam({ name: 'id', description: 'UUID de la publicación' })
  @ApiResponse({ status: 200, description: '{ reported: true }' })
  @ApiResponse({ status: 404, description: 'Publicación no encontrada' })
  reportPost(
    @Param('id') id: string,
    @UserId() userId: string,
    @Body() dto: ReportPostDto,
  ) {
    return this.service.reportPost(id, userId, dto.reason);
  }

  // ── Moderación (psicólogo, desde el dashboard) ───────────────────────────

  // El rol lo sigue validando el servicio (`assertPsychologist`); lo que faltaba acá era
  // que la identidad viniera del token: con `x-user-id` bastaba escribir el UUID de un
  // psicólogo para leer todo lo reportado, con el texto y el nombre de quien lo escribió.
  @Get('moderation/flagged')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lista publicaciones con 1+ reporte para moderación (psicólogo)' })
  @ApiQuery({ name: 'sede', description: 'Sede (Santiago | Viña del Mar | Concepción)' })
  @ApiResponse({
    status: 200,
    description: 'CommunityPost[] reportadas, con los motivos (sin identificar al denunciante)',
  })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido' })
  @ApiResponse({ status: 403, description: 'Solo un psicólogo puede moderar' })
  findFlagged(
    @CurrentUser() user: AuthUser,
    @Query('sede') sede?: string,
  ) {
    return this.service.findFlaggedPosts(sede, user.id);
  }

  @Post('moderation/posts/:id/dismiss')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'Descarta los reportes de una publicación y la deja en la comunidad (psicólogo)' })
  @ApiParam({ name: 'id', description: 'UUID de la publicación' })
  @ApiResponse({ status: 200, description: '{ dismissed: número de reportes descartados }' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido' })
  @ApiResponse({ status: 403, description: 'Solo un psicólogo puede moderar' })
  @ApiResponse({ status: 404, description: 'Publicación no encontrada' })
  dismissReports(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.dismissReports(id, user.id);
  }

  // Sin `@Roles`: el servicio deja borrar al autor su propia publicación y a un psicólogo
  // cualquiera reportada. Un guard de rol acá le quitaría al paciente el borrado de lo suyo.
  @Delete('posts/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'Elimina una publicación propia, o una reportada si es psicólogo' })
  @ApiParam({ name: 'id', description: 'UUID de la publicación' })
  @ApiResponse({ status: 200, description: '{ deleted: true }' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido' })
  @ApiResponse({ status: 403, description: 'No es el autor ni un psicólogo' })
  @ApiResponse({ status: 404, description: 'Publicación no encontrada' })
  deletePost(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.deletePost(id, user.id);
  }
}
