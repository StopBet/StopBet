import { Body, Controller, Get, Headers, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RegistrationService } from './registration.service';
import { SubmitRegistrationDto } from './dto/submit-registration.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('registration')
@Controller('registration')
export class RegistrationController {
  constructor(private readonly registrationService: RegistrationService) {}

  // Devuelve nombre, apellido y correo de quienes solicitan tratamiento: sin
  // guard quedaba abierto a cualquiera que supiera la URL.
  @Get('pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('psychologist', 'coordinator')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lista solicitudes de registro pendientes (vista psicólogo)' })
  @ApiResponse({ status: 200, description: 'RegistrationRequest[] con datos de usuario' })
  @ApiResponse({ status: 401, description: 'Sin token' })
  @ApiResponse({ status: 403, description: 'Rol sin permiso' })
  listPending() {
    return this.registrationService.listPending();
  }

  @Post('submit')
  @ApiOperation({ summary: 'Envía la solicitud de registro del paciente (pasos 1+2)' })
  @ApiResponse({ status: 201, description: 'Solicitud creada: { userId, requestId, status }' })
  @ApiResponse({ status: 409, description: 'Email ya registrado' })
  submit(@Body() dto: SubmitRegistrationDto) {
    return this.registrationService.submit(dto);
  }

  @Get(':requestId')
  @ApiOperation({ summary: 'Consulta el estado de una solicitud de registro' })
  @ApiParam({ name: 'requestId', description: 'UUID de la solicitud' })
  @ApiResponse({ status: 200, description: 'RegistrationRequest' })
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada' })
  getStatus(@Param('requestId') requestId: string) {
    return this.registrationService.getStatus(requestId);
  }

  @Patch(':requestId/approve')
  @ApiOperation({ summary: 'Psicólogo aprueba la solicitud' })
  @ApiHeader({ name: 'x-user-id', description: 'UUID del psicólogo' })
  @ApiResponse({ status: 200, description: 'Aprobado — notificación enviada al paciente' })
  approve(
    @Param('requestId') requestId: string,
    @Headers('x-user-id') psychologistId: string,
  ) {
    return this.registrationService.approve(requestId, psychologistId);
  }

  @Patch(':requestId/reject')
  @ApiOperation({ summary: 'Psicólogo rechaza la solicitud' })
  @ApiHeader({ name: 'x-user-id', description: 'UUID del psicólogo' })
  @ApiResponse({ status: 200, description: 'Rechazado — notificación enviada al paciente' })
  reject(
    @Param('requestId') requestId: string,
    @Headers('x-user-id') psychologistId: string,
  ) {
    return this.registrationService.reject(requestId, psychologistId);
  }
}
