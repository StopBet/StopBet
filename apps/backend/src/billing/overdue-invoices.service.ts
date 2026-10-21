import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { InvoiceStatus } from '@stopbet/shared-types';
import { Invoice } from './entities/invoice.entity';
import { todayInChile } from '../common/chile-date';

// HdU09: hasta ahora ninguna cuota pasaba sola de «pendiente» a «vencida»; las vencidas salían
// solo del seed. El vencimiento es el último día del mes, así que la pasada va pasada la
// medianoche de Chile, cuando ese día ya terminó.
//
// Solo marca la cuota. No suspende la cuenta ni avisa al paciente: cuándo se suspende por mora
// sigue sin decidir (docs/ASUNCIONES-PENDIENTES.md, puntos 4-6).
const OVERDUE_CRON = '5 0 * * *';

// Explícita: el servidor corre en UTC (Railway) y la medianoche del servidor no es la de Chile.
const CHILE_TZ = 'America/Santiago';

@Injectable()
export class OverdueInvoicesService implements OnApplicationBootstrap {
  private readonly logger = new Logger(OverdueInvoicesService.name);

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
  ) {}

  // También al arrancar: un deploy o un reinicio justo a medianoche se saltaría la pasada del
  // día, y la cuota quedaría «pendiente» un día entero después de vencer.
  onApplicationBootstrap(): void {
    void this.markOverdue().catch((err: Error) =>
      this.logger.error(`No se pudieron marcar las cuotas vencidas al arrancar: ${err.message}`),
    );
  }

  @Cron(OVERDUE_CRON, { timeZone: CHILE_TZ })
  async markOverdue(today: string = todayInChile()): Promise<number> {
    const result = await this.invoiceRepo.update(
      { status: 'pending' as InvoiceStatus, dueDate: LessThan(today) },
      { status: 'overdue' as InvoiceStatus },
    );
    const marked = result.affected ?? 0;
    // Solo el conteo: nunca identificadores de pacientes en los logs.
    if (marked > 0) this.logger.log(`Cuotas marcadas como vencidas: ${marked}`);
    return marked;
  }
}
