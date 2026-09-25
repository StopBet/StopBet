import { Body, Controller, Delete, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserId } from '../common/decorators/user-id.decorator';
import { PushService } from './push.service';
import { RegisterTokenDto } from './dto/register-token.dto';

@ApiTags('push')
@ApiBearerAuth()
@Controller('push')
export class PushController {
  constructor(private readonly service: PushService) {}

  @Post('tokens')
  @ApiOperation({ summary: 'Registra el token FCM del dispositivo del paciente' })
  @ApiResponse({ status: 201, description: 'Token registrado o reasignado' })
  registrar(@UserId() userId: string, @Body() dto: RegisterTokenDto) {
    return this.service.registrarToken(userId, dto.token, dto.platform);
  }

  @Delete('tokens')
  @ApiOperation({ summary: 'Olvida el token, por ejemplo al cerrar sesión' })
  @ApiResponse({ status: 200, description: 'Token eliminado si existía' })
  olvidar(@Body() dto: RegisterTokenDto) {
    return this.service.olvidarToken(dto.token);
  }
}
