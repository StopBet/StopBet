import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SedesService } from './sedes.service';

@ApiTags('sedes')
@Controller('sedes')
export class SedesController {
  constructor(private readonly sedesService: SedesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista todas las sedes activas de AJUTER' })
  @ApiResponse({ status: 200, description: 'Sede[]' })
  findAll() {
    return this.sedesService.findAll();
  }
}
