import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('patients')
  @ApiOperation({ summary: 'Lista de todos los pacientes (vista psicólogo)' })
  @ApiResponse({ status: 200, description: 'PatientListItem[]' })
  listPatients() {
    return this.usersService.listPatients();
  }

  @Get(':id/progress')
  @ApiOperation({ summary: 'Progreso del paciente: racha, hito, último check-in' })
  @ApiParam({ name: 'id', description: 'UUID del usuario' })
  @ApiResponse({ status: 200, description: 'PatientProgress' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  getProgress(@Param('id') id: string) {
    return this.usersService.getProgress(id);
  }
}
