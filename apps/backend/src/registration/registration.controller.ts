import { Body, Controller, Get, Headers, Param, Patch, Post } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RegistrationService } from './registration.service';
import { SubmitRegistrationDto } from './dto/submit-registration.dto';

@ApiTags('registration')
@Controller('registration')
export class RegistrationController {
  constructor(private readonly registrationService: RegistrationService) {}

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
