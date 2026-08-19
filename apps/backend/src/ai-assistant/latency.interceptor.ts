import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

// S.2: mide la latencia de respuesta del asistente y avisa si supera el umbral (5 s).
// Nunca loguear contenido del mensaje ni identificadores de paciente — solo duración
// y ruta (CLAUDE.md, seguridad clínica: nunca loguear datos identificables).
const LATENCY_WARN_THRESHOLD_MS = 5_000;

@Injectable()
export class LatencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AiAssistantLatency');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = Date.now();
    const request = context.switchToHttp().getRequest<{ method: string; route?: { path: string } }>();

    return next.handle().pipe(
      tap(() => {
        const durationMs = Date.now() - start;
        const route = request.route?.path ?? 'unknown';

        if (durationMs > LATENCY_WARN_THRESHOLD_MS) {
          this.logger.warn(`Respuesta del asistente excedió 5s: ${durationMs}ms en ${request.method} ${route}`);
        } else {
          this.logger.debug(`${request.method} ${route} → ${durationMs}ms`);
        }
      }),
    );
  }
}