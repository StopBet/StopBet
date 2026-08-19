import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { MetricsService } from './metrics.service';
import { PatientMetricsDto } from './dto/patient-metrics.dto';

@ApiTags('metrics')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('patients/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('psychologist', 'coordinator')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Métricas del paciente: evolución 30 días, check-ins y alertas del periodo' })
  @ApiParam({ name: 'id', description: 'UUID del paciente' })
  @ApiResponse({ status: 200, description: 'PatientMetrics', type: PatientMetricsDto })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido' })
  @ApiResponse({ status: 403, description: 'Rol sin permiso para ver métricas de pacientes' })
  getPatientMetrics(@Param('id') id: string) {
    return this.metricsService.getPatientMetrics(id);
  }
}