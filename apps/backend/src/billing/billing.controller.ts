import { Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserId } from '../common/decorators/user-id.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PatientAccessGuard } from '../common/guards/patient-access.guard';
import { BillingService } from './billing.service';

@ApiTags('billing')
@ApiBearerAuth()
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('status')
  @ApiOperation({ summary: 'Devuelve el estado de cuenta y facturas vencidas del paciente' })
  @ApiResponse({ status: 200, description: 'BillingStatus' })
  getStatus(@UserId() userId: string) {
    return this.billingService.getBillingStatus(userId);
  }

  // Para el reporte PDF de la ficha. Antes la web pedía /billing/status mandando el id del
  // paciente en x-user-id: cualquiera leía el estado de cuenta de cualquier paciente.
  @Get('patients/:patientId/status')
  @UseGuards(RolesGuard, PatientAccessGuard)
  @Roles('psychologist', 'coordinator')
  @ApiOperation({ summary: 'Estado de cuotas de un paciente (equipo clínico)' })
  @ApiParam({ name: 'patientId', description: 'UUID del paciente' })
  @ApiResponse({ status: 200, description: 'BillingStatus' })
  @ApiResponse({ status: 403, description: 'Rol sin permiso, o paciente no asignado a este psicólogo' })
  getPatientStatus(@Param('patientId') patientId: string) {
    return this.billingService.getBillingStatus(patientId);
  }

  @Post('pay')
  @HttpCode(200)
  @ApiOperation({ summary: 'Paga todas las facturas vencidas y reactiva la cuenta' })
  @ApiResponse({ status: 200, description: 'BillingStatus actualizado con cuenta activa' })
  pay(@UserId() userId: string) {
    return this.billingService.pay(userId);
  }

  @Get('family-link')
  @ApiOperation({ summary: 'Genera enlace de pago para que un familiar reactive la cuenta' })
  @ApiResponse({ status: 200, description: '{ token, url }' })
  getFamilyLink(@UserId() userId: string) {
    return this.billingService.getFamilyLink(userId);
  }
}
