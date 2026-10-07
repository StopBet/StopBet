import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '@stopbet/shared-types';
import { RegistrationService } from './registration.service';
import { SubmitRegistrationDto } from './dto/submit-registration.dto';
import { ApproveRegistrationDto } from './dto/approve-registration.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

// HdU19 v2: solo coordinación decide sobre las solicitudes de ingreso. Es un supuesto sin
// confirmar: ver docs/hdu19-solicitudes-ingreso-v2.md antes de devolverle el acceso al psicólogo.
@ApiTags('registration')
@Controller('registration')
export class RegistrationController {
  constructor(private readonly registrationService: RegistrationService) {}

  // Devuelve nombre, apellido, correo y RUT de quienes solicitan tratamiento: sin
  // guard quedaba abierto a cualquiera que supiera la URL.
  @Get('pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('coordinator')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lista solicitudes de registro pendientes (vista coordinación)' })
  @ApiResponse({ status: 200, description: 'RegistrationRequest[] con datos de usuario' })
  @ApiResponse({ status: 401, description: 'Sin token' })
  @ApiResponse({ status: 403, description: 'Solo coordinación (HdU19 v2)' })
  listPending(@CurrentUser() user: AuthUser) {
    return this.registrationService.listPending(user);
  }

  // Debe declararse antes de `:requestId`, que es @Public(): si no, Nest captura `rejected`
  // como un requestId y este endpoint quedaría abierto a cualquiera.
  @Get('rejected')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('coordinator')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lista las últimas solicitudes rechazadas, para poder reabrirlas' })
  @ApiResponse({ status: 200, description: 'RegistrationRequest[] rechazadas, con quién las revisó' })
  @ApiResponse({ status: 401, description: 'Sin token' })
  @ApiResponse({ status: 403, description: 'Solo coordinación (HdU19 v2)' })
  listRejected(@CurrentUser() user: AuthUser) {
    return this.registrationService.listRejected(user);
  }

  // Misma razón que `rejected`: va antes de `:requestId`, que es público.
  @Get('history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('coordinator')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bitácora de decisiones sobre solicitudes: quién, cuándo y qué veredicto (CA6)' })
  @ApiResponse({ status: 200, description: 'Las últimas decisiones, la más reciente primero' })
  @ApiResponse({ status: 401, description: 'Sin token' })
  @ApiResponse({ status: 403, description: 'Solo coordinación (HdU19 v2)' })
  listHistory() {
    return this.registrationService.listHistory();
  }

  // Público: quien se registra todavía no tiene cuenta.
  @Public()
  @Post('submit')
  @ApiOperation({ summary: 'Envía la solicitud de registro del paciente (pasos 1+2)' })
  @ApiResponse({ status: 201, description: 'Solicitud creada: { userId, requestId, status }' })
  @ApiResponse({ status: 409, description: 'Email ya registrado' })
  submit(@Body() dto: SubmitRegistrationDto) {
    return this.registrationService.submit(dto);
  }

  // Público: la pantalla de «solicitud enviada» consulta el estado sin sesión. El UUID de la
  // solicitud hace de secreto.
  @Public()
  @Get(':requestId')
  @ApiOperation({ summary: 'Consulta el estado de una solicitud de registro' })
  @ApiParam({ name: 'requestId', description: 'UUID de la solicitud' })
  @ApiResponse({ status: 200, description: 'RegistrationRequest' })
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada' })
  getStatus(@Param('requestId') requestId: string) {
    return this.registrationService.getStatus(requestId);
  }

  // Decide quién entra a la clínica: sin guard cualquiera que supiera la URL podía aprobar
  // una solicitud inventando el `x-user-id` del revisor.
  @Patch(':requestId/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('coordinator')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Coordinación aprueba la solicitud y asigna al paciente' })
  @ApiBody({ type: ApproveRegistrationDto, required: false })
  @ApiResponse({ status: 200, description: 'Aprobado — notificación enviada al paciente' })
  @ApiResponse({ status: 400, description: 'Falta indicar el psicólogo asignado' })
  @ApiResponse({ status: 401, description: 'Sin token' })
  @ApiResponse({ status: 403, description: 'Solo coordinación (HdU19 v2)' })
  @ApiResponse({ status: 409, description: 'La solicitud no existe o ya fue procesada' })
  approve(
    @Param('requestId') requestId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ApproveRegistrationDto,
  ) {
    return this.registrationService.approve(requestId, user, dto);
  }

  @Patch(':requestId/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('coordinator')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Coordinación rechaza la solicitud' })
  @ApiResponse({ status: 200, description: 'Rechazado — notificación enviada al paciente' })
  @ApiResponse({ status: 401, description: 'Sin token' })
  @ApiResponse({ status: 403, description: 'Solo coordinación (HdU19 v2)' })
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada' })
  @ApiResponse({ status: 409, description: 'La solicitud ya fue procesada' })
  reject(
    @Param('requestId') requestId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.registrationService.reject(requestId, user);
  }

  @Patch(':requestId/reopen')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('coordinator')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Coordinación reabre una solicitud rechazada: vuelve a pendientes' })
  @ApiResponse({ status: 200, description: 'Reabierta — notificación enviada al paciente' })
  @ApiResponse({ status: 401, description: 'Sin token' })
  @ApiResponse({ status: 403, description: 'Solo coordinación (HdU19 v2)' })
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada' })
  @ApiResponse({ status: 409, description: 'Solo se puede reabrir una solicitud rechazada' })
  reopen(
    @Param('requestId') requestId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.registrationService.reopen(requestId, user);
  }
}
