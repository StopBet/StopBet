import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserId } from '../common/decorators/user-id.decorator';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

@ApiTags('subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post()
  @ApiOperation({ summary: 'Procesa el pago mensual y activa la cuenta del paciente' })
  @ApiResponse({ status: 201, description: 'Subscription creada + cuenta activada' })
  @ApiResponse({ status: 400, description: 'Usuario no habilitado para pagar' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  create(@UserId() userId: string, @Body() dto: CreateSubscriptionDto) {
    return this.subscriptionsService.create(userId, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Historial de suscripciones del usuario' })
  @ApiResponse({ status: 200, description: 'Subscription[]' })
  findMine(@UserId() userId: string) {
    return this.subscriptionsService.findByUser(userId);
  }
}
