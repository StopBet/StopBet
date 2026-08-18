import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { IsEmail, IsString } from 'class-validator';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Login del psicólogo — verifica email y rol' })
  @ApiResponse({ status: 200, description: 'Login exitoso' })
  @ApiResponse({ status: 401, description: 'Credenciales incorrectas' })
  @ApiResponse({ status: 403, description: 'Usuario no es psicólogo' })
  login(@Body() body: LoginDto) {
    return this.usersService.login(body.email);
  }

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
