import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PsychologistsService } from './psychologists.service';
import { CreatePsychologistDto } from './dto/create-psychologist.dto';
import { DeactivatePsychologistDto } from './dto/deactivate-psychologist.dto';
import { UpdateSedesDto } from './dto/update-sedes.dto';

@ApiTags('psychologists')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Controller('psychologists')
export class PsychologistsController {
  constructor(private readonly psychologistsService: PsychologistsService) {}

  @Post()
  @Roles('coordinator')
  @ApiOperation({ summary: 'Crear un psicólogo con sus sedes asignadas' })
  @ApiResponse({ status: 201, description: 'CreatePsychologistResponse — incluye la contraseña temporal, una sola vez' })
  @ApiResponse({ status: 400, description: 'Una o más sedes no existen o están inactivas' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido' })
  @ApiResponse({ status: 403, description: 'Rol sin permiso — requiere coordinator' })
  @ApiResponse({ status: 409, description: 'Ya existe una cuenta con este correo electrónico' })
  create(@Body() dto: CreatePsychologistDto) {
    return this.psychologistsService.create(dto);
  }

  @Get()
  @Roles('psychologist', 'coordinator')
  @ApiOperation({ summary: 'Listar psicólogos con sus sedes y cantidad de pacientes activos' })
  @ApiResponse({ status: 200, description: 'PsychologistListItem[]' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido' })
  @ApiResponse({ status: 403, description: 'Rol sin permiso' })
  findAll() {
    return this.psychologistsService.findAll();
  }

  @Get(':id')
  @Roles('psychologist', 'coordinator')
  @ApiOperation({ summary: 'Detalle de un psicólogo' })
  @ApiParam({ name: 'id', description: 'UUID del psicólogo' })
  @ApiResponse({ status: 200, description: 'PsychologistListItem' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido' })
  @ApiResponse({ status: 403, description: 'Rol sin permiso' })
  @ApiResponse({ status: 404, description: 'Psicólogo no encontrado' })
  findOne(@Param('id') id: string) {
    return this.psychologistsService.findOne(id);
  }

  @Patch(':id/deactivate')
  @Roles('coordinator')
  @ApiOperation({ summary: 'Desactivar un psicólogo, exigiendo reasignar a sus pacientes activos primero' })
  @ApiParam({ name: 'id', description: 'UUID del psicólogo' })
  @ApiResponse({ status: 200, description: 'Desactivado' })
  @ApiResponse({ status: 400, description: 'reassignTo apunta al mismo psicólogo que se desactiva' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido' })
  @ApiResponse({ status: 403, description: 'Rol sin permiso — requiere coordinator' })
  @ApiResponse({ status: 404, description: 'Psicólogo (o el de destino) no encontrado' })
  @ApiResponse({ status: 409, description: 'Tiene pacientes activos: falta reassignTo' })
  deactivate(@Param('id') id: string, @Body() dto: DeactivatePsychologistDto) {
    return this.psychologistsService.deactivate(id, dto);
  }

  @Patch(':id/sedes')
  @Roles('coordinator')
  @ApiOperation({ summary: 'Agregar o quitar sedes, exigiendo reasignar pacientes de las sedes que se quitan' })
  @ApiParam({ name: 'id', description: 'UUID del psicólogo' })
  @ApiResponse({ status: 200, description: 'Sedes actualizadas' })
  @ApiResponse({ status: 400, description: 'Sede inválida o el set queda vacío' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido' })
  @ApiResponse({ status: 403, description: 'Rol sin permiso — requiere coordinator' })
  @ApiResponse({ status: 409, description: 'Una sede que se quita tiene pacientes activos sin reasignar' })
  updateSedes(@Param('id') id: string, @Body() dto: UpdateSedesDto) {
    return this.psychologistsService.updateSedes(id, dto);
  }
}
