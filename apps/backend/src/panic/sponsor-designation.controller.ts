import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthUser } from '@stopbet/shared-types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { DesignateSponsorDto } from './dto/designate-sponsor.dto';
import { SponsorDesignationService } from './sponsor-designation.service';

// `JwtAuthGuard` es global desde ceeaa9a, así que acá solo hace falta el de roles.
@ApiTags('sponsors')
@ApiBearerAuth()
@Controller('sponsors')
@UseGuards(RolesGuard)
@Roles('psychologist', 'coordinator')
export class SponsorDesignationController {
  constructor(private readonly service: SponsorDesignationService) {}

  @Get('candidates')
  @ApiOperation({
    summary: 'CA21.2: pacientes activos de la sede que aún no son padrinos',
  })
  @ApiResponse({ status: 200, description: 'SponsorCandidate[]' })
  @ApiResponse({ status: 403, description: 'Rol sin permiso para designar' })
  listCandidates(@CurrentUser() actor: AuthUser) {
    return this.service.listCandidates(actor);
  }

  @Post('designate')
  @ApiOperation({ summary: 'CA21.1: designar a un paciente como padrino' })
  @ApiResponse({ status: 201, description: 'SponsorDesignationDto' })
  @ApiResponse({ status: 403, description: 'El paciente no es de tu sede' })
  @ApiResponse({ status: 404, description: 'El paciente no existe' })
  @ApiResponse({ status: 409, description: 'El paciente ya es padrino' })
  designate(
    @Body() dto: DesignateSponsorDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.service.designate(dto.patientId, actor);
  }

  @Post(':patientId/revoke')
  @ApiOperation({
    summary: 'CA21.3: revocar el rol, si no tiene pacientes a cargo',
  })
  @ApiParam({ name: 'patientId', description: 'UUID del compañero de viaje' })
  @ApiResponse({ status: 201, description: 'SponsorDesignationDto' })
  @ApiResponse({ status: 403, description: 'El paciente no es de tu sede' })
  @ApiResponse({ status: 404, description: 'No es compañero de viaje' })
  @ApiResponse({
    status: 409,
    description: 'Tiene pacientes a cargo: hay que reasignarlos primero',
  })
  revoke(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.service.revoke(patientId, actor);
  }
}
