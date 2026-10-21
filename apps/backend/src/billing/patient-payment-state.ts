import { InvoiceStatus, PatientPaymentState } from '@stopbet/shared-types';

export interface InvoiceLike {
  month: string; // 'YYYY-MM'
  amountCLP: number;
  status: InvoiceStatus;
  dueDate: string; // 'YYYY-MM-DD'
}

export interface PaymentSummary {
  state: PatientPaymentState;
  totalOwedCLP: number;
  nextDueDate: string | null;
  daysOverdue: number;
  overdueMonths: number;
}

// Una cuota `pending` con el vencimiento ya pasado cuenta como vencida aunque el proceso diario
// todavía no la haya marcado: si el backend estuvo caído a medianoche, Finanzas no puede mostrar
// «pendiente» a alguien que ya está atrasado.
//
// «Pendiente» es solo la cuota del mes en curso (o anterior) que todavía no vence. La del mes
// siguiente existe siempre —`settleInvoices` la crea al pagar— y si contara, nadie estaría
// nunca «al día».
export function summarizePayments(invoices: InvoiceLike[], today: string): PaymentSummary {
  const currentMonth = today.slice(0, 7);
  const unpaid = invoices.filter((i) => i.status !== 'paid');
  const overdue = unpaid.filter((i) => i.status === 'overdue' || i.dueDate < today);
  const current = unpaid.filter((i) => !overdue.includes(i) && i.month <= currentMonth);

  const byDueDate = (a: InvoiceLike, b: InvoiceLike) => a.dueDate.localeCompare(b.dueDate);
  const firstOverdue = [...overdue].sort(byDueDate)[0];
  const nextUnpaid = [...unpaid].sort(byDueDate)[0];

  return {
    state: overdue.length > 0 ? 'overdue' : current.length > 0 ? 'pending' : 'up_to_date',
    totalOwedCLP: [...overdue, ...current].reduce((sum, i) => sum + i.amountCLP, 0),
    nextDueDate: nextUnpaid?.dueDate ?? null,
    daysOverdue: firstOverdue ? daysBetween(firstOverdue.dueDate, today) : 0,
    overdueMonths: overdue.length,
  };
}

function daysBetween(start: string, end: string): number {
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const ms = Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd);
  return Math.max(0, Math.floor(ms / 86_400_000));
}
