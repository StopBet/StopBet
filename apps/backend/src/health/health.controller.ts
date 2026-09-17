import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { Public } from '../common/decorators/public.decorator';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  // Público: lo consulta el healthcheck de Railway, que no tiene sesión.
  @Public()
  @Get('health')
  @HealthCheck()
  @ApiOperation({ summary: 'Health check del servidor — verifica conexión real a la base de datos' })
  @ApiResponse({ status: 200, description: 'Backend y base de datos respondiendo' })
  @ApiResponse({ status: 503, description: 'La base de datos no responde' })
  check() {
    return this.health.check([() => this.db.pingCheck('database')]);
  }
}
