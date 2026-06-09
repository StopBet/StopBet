import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BillingStatus,
  Invoice as InvoiceType,
  InvoiceStatus,
} from '@stopbet/shared-types';
import { Invoice } from './entities/invoice.entity';
import { User } from '../users/entities/user.entity';
import { Notification } from '../notifications/entities/notification.entity';

const MONTHLY_AMOUNT_CLP = 30_000;

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

    const now = new Date();
    for (const invoice of overdueInvoices) {
      invoice.status = 'paid' as InvoiceStatus;
      invoice.paidAt = now;
    }
    await this.invoiceRepo.save(overdueInvoices);

    await this.userRepo.update(userId, { accountStatus: 'active' });

    // Genera la factura del mes siguiente si no existe
    const nextMonth = this.nextMonthStr(this.today());
    const exists = await this.invoiceRepo.findOne({
      where: { userId, month: nextMonth },
    });
    if (!exists) {
      const [y, m] = nextMonth.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      await this.invoiceRepo.save(
        this.invoiceRepo.create({
          userId,
          month: nextMonth,
          amountCLP: MONTHLY_AMOUNT_CLP,
          status: 'pending',
          dueDate: `${nextMonth}-${String(lastDay).padStart(2, '0')}`,
        }),
      );
    }

    await this.notifRepo.save(
      this.notifRepo.create({
        userId,
        type: 'success',
        title: '¡Cuenta reactivada!',
        body: 'Tu pago fue procesado. Puedes retomar tu proceso de rehabilitación.',
      }),
    );

    return this.getBillingStatus(userId);
  }

  getFamilyLink(userId: string): { url: string; token: string } {
    // Token simple para MVP — en producción usar JWT firmado con expiración
    const raw = `${userId}:${Date.now()}`;
    const token = Buffer.from(raw).toString('base64').replace(/[+/=]/g, '').slice(0, 12);
    const baseUrl = this.configService.get<string>('APP_URL') ?? 'https://stopbet.cl';
    return { token, url: `${baseUrl}/pago/${token}` };
  }

  private today(): string {
    return new Date().toISOString().split('T')[0];
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
