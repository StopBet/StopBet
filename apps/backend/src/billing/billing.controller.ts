import { Controller, Get, Headers, HttpCode, Post } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BillingService } from './billing.service';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('status')
  @ApiOperation({ summary: 'Devuelve el estado de cuenta y facturas vencidas del paciente' })
  @ApiHeader({ name: 'x-user-id', description: 'UUID del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'BillingStatus' })
  getStatus(@Headers('x-user-id') userId: string) {
    return this.billingService.getBillingStatus(userId);
  }

  @Post('pay')
  @HttpCode(200)
  @ApiOperation({ summary: 'Paga todas las facturas vencidas y reactiva la cuenta' })
  @ApiHeader({ name: 'x-user-id', description: 'UUID del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'BillingStatus actualizado con cuenta activa' })
  pay(@Headers('x-user-id') userId: string) {
    return this.billingService.pay(userId);
  }

  @Get('family-link')
  @ApiOperation({ summary: 'Genera enlace de pago para que un familiar reactive la cuenta' })
  @ApiHeader({ name: 'x-user-id', description: 'UUID del usuario autenticado' })
  @ApiResponse({ status: 200, description: '{ token, url }' })
  getFamilyLink(@Headers('x-user-id') userId: string) {
    return this.billingService.getFamilyLink(userId);
  }
}
