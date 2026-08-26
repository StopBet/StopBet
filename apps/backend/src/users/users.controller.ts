import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('patients')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('psychologist', 'coordinator')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lista de todos los pacientes (vista psicólogo)' })
  @ApiResponse({ status: 200, description: 'PatientListItem[]' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido' })
  @ApiResponse({ status: 403, description: 'Rol sin permiso para ver la lista de pacientes' })
  listPatients() {
    return this.usersService.listPatients();
  }

  @Get(':id/progress')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('psychologist', 'coordinator')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Progreso del paciente: racha, hito, último check-in' })
  @ApiParam({ name: 'id', description: 'UUID del usuario' })
  @ApiResponse({ status: 200, description: 'PatientProgress' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido' })
  @ApiResponse({ status: 403, description: 'Rol sin permiso para ver el progreso de pacientes' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  getProgress(@Param('id') id: string) {
    return this.usersService.getProgress(id);
  }
}
