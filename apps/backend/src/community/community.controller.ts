import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ReactionEmoji } from '@stopbet/shared-types';
import { CommunityService } from './community.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateReplyDto } from './dto/create-reply.dto';
import { AddReactionDto } from './dto/add-reaction.dto';

@ApiTags('community')
@Controller('community')
export class CommunityController {
  constructor(private readonly service: CommunityService) {}

  // ── Anuncios ────────────────────────────────────────────────────────────

  @Get('announcements')
  @ApiOperation({ summary: 'Lista anuncios de una sede AJUTER' })
  @ApiHeader({ name: 'x-user-id', description: 'UUID del usuario autenticado' })
  @ApiQuery({ name: 'sede', description: 'Sede (Santiago | Viña del Mar | Concepción)' })
  @ApiResponse({ status: 200, description: 'Array de anuncios con estado de asistencia' })
  findAnnouncements(
    @Headers('x-user-id') userId: string,
    @Query('sede') sede: string,
  ) {
    return this.service.findAnnouncements(sede, userId);
  }

  @Post('announcements')
  @HttpCode(201)
  @ApiOperation({ summary: 'Crea un anuncio (psicólogo o admin)' })
  @ApiHeader({ name: 'x-user-id', description: 'UUID del autor' })
  @ApiResponse({ status: 201, description: 'Anuncio creado' })
  createAnnouncement(
    @Headers('x-user-id') authorId: string,
    @Body() dto: CreateAnnouncementDto,
  ) {
    return this.service.createAnnouncement(dto, authorId);
  }

  @Post('announcements/:id/attend')
  @HttpCode(200)
  @ApiOperation({ summary: 'Confirmar o cancelar asistencia a un evento (toggle)' })
  @ApiHeader({ name: 'x-user-id', description: 'UUID del usuario' })
  @ApiParam({ name: 'id', description: 'UUID del anuncio' })
  @ApiResponse({ status: 200, description: '{ attends: boolean }' })
  @ApiResponse({ status: 404, description: 'Anuncio no encontrado' })
  toggleAttendance(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.service.toggleAttendance(id, userId);
  }

  // ── Foro ────────────────────────────────────────────────────────────────

  @Get('posts')
  @ApiOperation({ summary: 'Lista publicaciones del foro por sede (paginado)' })
  @ApiHeader({ name: 'x-user-id', description: 'UUID del usuario autenticado' })
  @ApiQuery({ name: 'sede', description: 'Sede (Santiago | Viña del Mar | Concepción)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'PaginatedResponse<CommunityPost>' })
  findPosts(
    @Headers('x-user-id') userId: string,
    @Query('sede') sede: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.service.findPosts(sede, Number(page), Number(limit), userId);
  }

  @Post('posts')
  @HttpCode(201)
  @ApiOperation({ summary: 'Publica un mensaje en el foro comunitario' })
  @ApiHeader({ name: 'x-user-id', description: 'UUID del paciente' })
  @ApiResponse({ status: 201, description: 'Publicación creada' })
  createPost(
    @Headers('x-user-id') authorId: string,
    @Body() dto: CreatePostDto,
  ) {
    return this.service.createPost(dto, authorId);
  }

  @Post('posts/:id/reactions')
  @HttpCode(200)
  @ApiOperation({ summary: 'Agrega una reacción emoji a una publicación (idempotente)' })
  @ApiHeader({ name: 'x-user-id', description: 'UUID del usuario' })
  @ApiParam({ name: 'id', description: 'UUID de la publicación' })
  @ApiResponse({ status: 200, description: 'Resumen actualizado de reacciones' })
  @ApiResponse({ status: 404, description: 'Publicación no encontrada' })
  addReaction(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
    @Body() dto: AddReactionDto,
  ) {
    return this.service.addReaction(id, dto.emoji as ReactionEmoji, userId);
  }

  @Delete('posts/:id/reactions/:emoji')
  @HttpCode(200)
  @ApiOperation({ summary: 'Elimina una reacción emoji de una publicación' })
  @ApiHeader({ name: 'x-user-id', description: 'UUID del usuario' })
  @ApiParam({ name: 'id', description: 'UUID de la publicación' })
  @ApiParam({ name: 'emoji', description: 'Emoji url-encoded (%F0%9F%92%AA para 💪)' })
  @ApiResponse({ status: 200, description: 'Resumen actualizado de reacciones' })
  @ApiResponse({ status: 400, description: 'Emoji inválido' })
  removeReaction(
    @Param('id') id: string,
    @Param('emoji') emoji: string,
    @Headers('x-user-id') userId: string,
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
  @ApiHeader({ name: 'x-user-id', description: 'UUID del usuario' })
  @ApiParam({ name: 'id', description: 'UUID de la publicación' })
  @ApiResponse({ status: 201, description: 'Respuesta creada' })
  @ApiResponse({ status: 404, description: 'Publicación no encontrada' })
  createReply(
    @Param('id') id: string,
    @Headers('x-user-id') authorId: string,
    @Body() dto: CreateReplyDto,
  ) {
    return this.service.createReply(id, dto, authorId);
  }

  @Post('posts/:id/report')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reporta una publicación (máx 1 reporte por usuario)' })
  @ApiHeader({ name: 'x-user-id', description: 'UUID del usuario' })
  @ApiParam({ name: 'id', description: 'UUID de la publicación' })
  @ApiResponse({ status: 200, description: '{ reported: true }' })
  @ApiResponse({ status: 404, description: 'Publicación no encontrada' })
  reportPost(@Param('id') id: string, @Headers('x-user-id') userId: string) {
    return this.service.reportPost(id, userId);
  }

  // ── Moderación (psicólogo, desde el dashboard) ───────────────────────────

  @Get('moderation/flagged')
  @ApiOperation({ summary: 'Lista publicaciones con 1+ reporte para moderación (psicólogo)' })
  @ApiHeader({ name: 'x-user-id', description: 'UUID del psicólogo' })
  @ApiQuery({ name: 'sede', description: 'Sede (Santiago | Viña del Mar | Concepción)' })
  @ApiResponse({ status: 200, description: 'CommunityPost[] reportadas' })
  @ApiResponse({ status: 403, description: 'Solo un psicólogo puede moderar' })
  findFlagged(
    @Headers('x-user-id') userId: string,
    @Query('sede') sede?: string,
  ) {
    return this.service.findFlaggedPosts(sede, userId);
  }

  @Delete('posts/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Elimina una publicación reportada (psicólogo)' })
  @ApiHeader({ name: 'x-user-id', description: 'UUID del psicólogo' })
  @ApiParam({ name: 'id', description: 'UUID de la publicación' })
  @ApiResponse({ status: 200, description: '{ deleted: true }' })
  @ApiResponse({ status: 403, description: 'Solo un psicólogo puede moderar' })
  @ApiResponse({ status: 404, description: 'Publicación no encontrada' })
  deletePost(@Param('id') id: string, @Headers('x-user-id') userId: string) {
    return this.service.deletePost(id, userId);
  }
}
