import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SedesService } from './sedes.service';

@ApiTags('sedes')
@Controller('sedes')
export class SedesController {
  constructor(private readonly sedesService: SedesService) {}

  // Público: el registro de un paciente nuevo elige sede antes de tener cuenta.
  @Public()
  @Get()
  @ApiOperation({ summary: 'Lista todas las sedes activas de AJUTER' })
  @ApiResponse({ status: 200, description: 'Sede[]' })
  findAll() {
    return this.sedesService.findAll();
  }
}
