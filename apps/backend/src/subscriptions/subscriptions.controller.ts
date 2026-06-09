import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

@ApiTags('subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post()
  @ApiOperation({ summary: 'Procesa el pago mensual y activa la cuenta del paciente' })
  @ApiResponse({ status: 201, description: 'Subscription creada + cuenta activada' })
  @ApiResponse({ status: 400, description: 'Usuario no habilitado para pagar' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  create(@Body() dto: CreateSubscriptionDto) {
    return this.subscriptionsService.create(dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Historial de suscripciones del usuario' })
  @ApiHeader({ name: 'x-user-id', description: 'UUID del usuario autenticado' })
  findMine(@Headers('x-user-id') userId: string) {
    return this.subscriptionsService.findByUser(userId);
  }
}
