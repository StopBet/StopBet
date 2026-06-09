import { Controller, Get, Headers, Param, Patch } from '@nestjs/common';
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
  markAllRead(@Headers('x-user-id') userId: string) {
    return this.notificationsService.markAllRead(userId);
  }
}
