import { Controller, MessageEvent, Sse } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Observable, interval, map, switchMap } from 'rxjs';
import { PanicService } from './panic.service';

// 4.1: alertas de pánico visibles en el dashboard sin recargar. No hay hook de
// emisión en panic.service.ts (es de otro integrante), así que este controller
// hace polling propio a la BD y lo reenvía por SSE — el cliente decide qué hacer
// al recibir un evento (típicamente invalidar su query de alertas).
const POLL_INTERVAL_MS = 5_000;

@ApiTags('panic')
@Controller('panic')
export class PanicStreamController {
  constructor(private readonly panicService: PanicService) {}

  @Sse('alerts/stream')
  @ApiOperation({ summary: 'Alertas de pánico en tiempo real (SSE) — vista psicólogo, sin recargar' })
  streamAlerts(): Observable<MessageEvent> {
    return interval(POLL_INTERVAL_MS).pipe(
      switchMap(() => this.panicService.listHistory()),
      map((alerts) => ({
        data: {
          count: alerts.length,
          pendingCount: alerts.filter((a) => a.status === 'pending').length,
          latestCreatedAt: alerts[0]?.createdAt ?? null,
        },
      })),
    );
  }
}