import { Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserId } from '../common/decorators/user-id.decorator';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista todas las notificaciones del usuario' })
  @ApiResponse({ status: 200, description: 'Notification[]' })
  findAll(@UserId() userId: string) {
    return this.notificationsService.findAllForUser(userId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marca una notificación como leída' })
  @ApiParam({ name: 'id', description: 'UUID de la notificación' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 404, description: 'Notificación no encontrada' })
  markRead(@Param('id') id: string, @UserId() userId: string) {
    return this.notificationsService.markRead(id, userId);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Marca todas las notificaciones como leídas' })
  @ApiResponse({ status: 200, description: 'OK' })
  markAllRead(@UserId() userId: string) {
    return this.notificationsService.markAllRead(userId);
  }

  @Get('community-mute')
  @ApiOperation({ summary: 'Consulta si el usuario silenció las notificaciones de comunidad' })
  @ApiResponse({ status: 200, description: '{ muted: boolean }' })
  async getCommunityMute(@UserId() userId: string) {
    return { muted: await this.notificationsService.isCommunityMuted(userId) };
  }

  @Post('community-mute')
  @HttpCode(200)
  @ApiOperation({ summary: 'Silencia las notificaciones de comunidad' })
  @ApiResponse({ status: 200, description: '{ muted: true }' })
  async muteCommunity(@UserId() userId: string) {
    await this.notificationsService.muteCommunity(userId);
    return { muted: true };
  }

  @Delete('community-mute')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reactiva las notificaciones de comunidad' })
  @ApiResponse({ status: 200, description: '{ muted: false }' })
  async unmuteCommunity(@UserId() userId: string) {
    await this.notificationsService.unmuteCommunity(userId);
    return { muted: false };
  }
}
