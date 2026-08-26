import { Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista todas las notificaciones del usuario' })
  @ApiHeader({ name: 'x-user-id', description: 'UUID del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Notification[]' })
  findAll(@Headers('x-user-id') userId: string) {
    return this.notificationsService.findAllForUser(userId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marca una notificación como leída' })
  @ApiHeader({ name: 'x-user-id', description: 'UUID del usuario autenticado' })
  @ApiParam({ name: 'id', description: 'UUID de la notificación' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 404, description: 'Notificación no encontrada' })
  markRead(@Param('id') id: string, @Headers('x-user-id') userId: string) {
    return this.notificationsService.markRead(id, userId);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Marca todas las notificaciones como leídas' })
  @ApiHeader({ name: 'x-user-id', description: 'UUID del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'OK' })
  markAllRead(@Headers('x-user-id') userId: string) {
    return this.notificationsService.markAllRead(userId);
  }

  @Get('community-mute')
  @ApiOperation({ summary: 'Consulta si el usuario silenció las notificaciones de comunidad' })
  @ApiHeader({ name: 'x-user-id', description: 'UUID del usuario autenticado' })
  @ApiResponse({ status: 200, description: '{ muted: boolean }' })
  async getCommunityMute(@Headers('x-user-id') userId: string) {
    return { muted: await this.notificationsService.isCommunityMuted(userId) };
  }

  @Post('community-mute')
  @HttpCode(200)
  @ApiOperation({ summary: 'Silencia las notificaciones de comunidad' })
  @ApiHeader({ name: 'x-user-id', description: 'UUID del usuario autenticado' })
  @ApiResponse({ status: 200, description: '{ muted: true }' })
  async muteCommunity(@Headers('x-user-id') userId: string) {
    await this.notificationsService.muteCommunity(userId);
    return { muted: true };
  }

  @Delete('community-mute')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reactiva las notificaciones de comunidad' })
  @ApiHeader({ name: 'x-user-id', description: 'UUID del usuario autenticado' })
  @ApiResponse({ status: 200, description: '{ muted: false }' })
  async unmuteCommunity(@Headers('x-user-id') userId: string) {
    await this.notificationsService.unmuteCommunity(userId);
    return { muted: false };
  }
}
