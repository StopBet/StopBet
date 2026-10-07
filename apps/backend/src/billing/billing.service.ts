import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Not, Repository } from 'typeorm';
import {
  BillingStatus,
  Invoice as InvoiceType,
  InvoiceStatus,
} from '@stopbet/shared-types';
import { Invoice } from './entities/invoice.entity';
import { User } from '../users/entities/user.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { todayInChile } from '../common/chile-date';

const MONTHLY_AMOUNT_CLP = 30_000;

// Qué se le dice al paciente al saldar sus cuotas: «reactivated» es el pago simulado de hoy
// (`pay`, que vuelve a abrir una cuenta suspendida); «payment» es un cobro real de la pasarela.
export type SettleNotification = 'reactivated' | 'payment';

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
    private readonly configService: ConfigService,
  ) {}

  async getBillingStatus(userId: string): Promise<BillingStatus> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const overdueInvoices = await this.invoiceRepo.find({
      where: { userId, status: 'overdue' },
      order: { dueDate: 'ASC' },
    });

    const totalOwedCLP = overdueInvoices.reduce((s, i) => s + i.amountCLP, 0);
    const firstOverdueDate = overdueInvoices[0]?.dueDate ?? null;
    const daysOverdue = firstOverdueDate
      ? this.daysBetween(firstOverdueDate, this.today())
      : 0;

    const nextPending = await this.invoiceRepo.findOne({
      where: { userId, status: 'pending' },
      order: { dueDate: 'ASC' },
    });

    return {
      accountStatus: user.accountStatus ?? 'active',
      overdueInvoices: overdueInvoices.map(this.mapInvoice),
      totalOwedCLP,
      overdueMonths: overdueInvoices.length,
      firstOverdueDate,
      daysOverdue,
      nextPaymentDate: nextPending?.dueDate ?? null,
    };
  }

  async pay(userId: string): Promise<BillingStatus> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const overdueInvoices = await this.invoiceRepo.find({
      where: { userId, status: 'overdue' },
    });

    await this.settleInvoices(userId, overdueInvoices, { notification: 'reactivated', reactivateAccount: true });

    return this.getBillingStatus(userId);
  }

  // Salda cuotas y deja el resto de la cuenta consistente. Lo usan el pago simulado (`pay`) y los
  // cobros reales de `payments`, para que una cuota pagada por cualquier camino tenga las mismas
  // consecuencias: sale de «vencida», la cuenta se reactiva solo si el llamador lo pide y ya no debe nada, existe la
  // cuota del mes siguiente y el paciente recibe su aviso.
  //
  // El update es condicional (`status <> 'paid'`): si dos caminos saldan la misma cuota a la vez,
  // la segunda no la vuelve a marcar. Con `manager`, todo ocurre en la transacción del cobro.
  async settleInvoices(
    userId: string,
    invoices: Invoice[],
    opts: { notification: SettleNotification; reactivateAccount: boolean; manager?: EntityManager },
  ): Promise<void> {
    const invoiceRepo = opts.manager ? opts.manager.getRepository(Invoice) : this.invoiceRepo;
    const userRepo = opts.manager ? opts.manager.getRepository(User) : this.userRepo;
    const notifRepo = opts.manager ? opts.manager.getRepository(Notification) : this.notifRepo;

    const ids = invoices.map((i) => i.id);
    if (ids.length > 0) {
      await invoiceRepo.update(
        { id: In(ids), userId, status: Not('paid' as InvoiceStatus) },
        { status: 'paid' as InvoiceStatus, paidAt: new Date() },
      );
    }

    // Reactivar la cuenta es decisión de quien llama. El pago simulado (`pay`) lo hace porque lo pide
    // el propio paciente con su sesión. Un cobro real NO: lo dispara el backend sin sesión, y una
    // cuenta suspendida no puede iniciar sesión justamente porque alguien cerró su acceso; que un
    // cobro lo reabra pasaría por encima de esa suspensión. Cuándo se levanta por pago es una
    // decisión pendiente del PO (docs/ASUNCIONES-PENDIENTES.md, punto 5).
    if (opts.reactivateAccount) {
      // Solo si no queda ninguna cuota vencida: pagar este mes no reabre a quien debe meses anteriores.
      const stillOverdue = (await invoiceRepo.find({ where: { userId, status: 'overdue' } })).filter(
        (i) => !ids.includes(i.id),
      );
      if (stillOverdue.length === 0) {
        await userRepo.update(userId, { accountStatus: 'active' });
      }
    }

    // Genera la factura del mes siguiente si no existe
    const nextMonth = this.nextMonthStr(this.today());
    const exists = await invoiceRepo.findOne({ where: { userId, month: nextMonth } });
    if (!exists) {
      const [y, m] = nextMonth.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      await invoiceRepo.save(
        invoiceRepo.create({
          userId,
          month: nextMonth,
          amountCLP: MONTHLY_AMOUNT_CLP,
          status: 'pending',
          dueDate: `${nextMonth}-${String(lastDay).padStart(2, '0')}`,
        }),
      );
    }

    const months = invoices.map((i) => i.month).join(', ');
    await notifRepo.save(
      notifRepo.create(
        opts.notification === 'reactivated'
          ? {
              userId,
              type: 'success',
              title: '¡Cuenta reactivada!',
              body: 'Tu cuenta quedó activa de nuevo. Puedes retomar tu proceso.',
            }
          : {
              userId,
              type: 'success',
              title: 'Recibimos tu pago',
              body: `Se cobró tu mensualidad${months ? ` (${months})` : ''}. ¡Gracias!`,
              target: 'payment',
            },
      ),
    );
  }

  getFamilyLink(userId: string): { url: string; token: string } {
    // Token simple para MVP — en producción usar JWT firmado con expiración
    const raw = `${userId}:${Date.now()}`;
    const token = Buffer.from(raw).toString('base64').replace(/[+/=]/g, '').slice(0, 12);
    const baseUrl = this.configService.get<string>('APP_URL') ?? 'https://stopbet.cl';
    return { token, url: `${baseUrl}/pago/${token}` };
  }

  private today(): string {
    return todayInChile();
  }

  private nextMonthStr(dateStr: string): string {
    const [y, m] = dateStr.split('-').map(Number);
    const next = new Date(y, m, 1); // primer día del mes siguiente
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
  }

  private daysBetween(start: string, end: string): number {
    const [sy, sm, sd] = start.split('-').map(Number);
    const [ey, em, ed] = end.split('-').map(Number);
    const ms = Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd);
    return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
  }

  private mapInvoice(i: Invoice): InvoiceType {
    return {
      id: i.id,
      userId: i.userId,
      month: i.month,
      amountCLP: i.amountCLP,
      status: i.status,
      dueDate: i.dueDate,
      paidAt: i.paidAt ? i.paidAt.toISOString() : null,
      createdAt: i.createdAt.toISOString(),
    };
  }
}
