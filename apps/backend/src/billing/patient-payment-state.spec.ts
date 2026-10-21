import { InvoiceLike, summarizePayments } from './patient-payment-state';

const TODAY = '2026-10-20';

const inv = (month: string, status: InvoiceLike['status'], dueDate = `${month}-28`): InvoiceLike => ({
  month,
  amountCLP: 30000,
  status,
  dueDate,
});

describe('summarizePayments (HdU09)', () => {
  it('está al día si pagó hasta el mes en curso, aunque exista la cuota del mes siguiente', () => {
    const s = summarizePayments(
      [inv('2026-09', 'paid'), inv('2026-10', 'paid'), inv('2026-11', 'pending', '2026-11-30')],
      TODAY,
    );
    expect(s).toEqual({
      state: 'up_to_date',
      totalOwedCLP: 0,
      nextDueDate: '2026-11-30',
      daysOverdue: 0,
      overdueMonths: 0,
    });
  });

  it('queda pendiente si la cuota del mes en curso no está pagada y todavía no vence', () => {
    const s = summarizePayments([inv('2026-09', 'paid'), inv('2026-10', 'pending', '2026-10-31')], TODAY);
    expect(s.state).toBe('pending');
    expect(s.totalOwedCLP).toBe(30000);
    expect(s.nextDueDate).toBe('2026-10-31');
    expect(s.daysOverdue).toBe(0);
  });

  it('queda vencido con al menos una cuota vencida, y cuenta los días desde la más antigua', () => {
    const s = summarizePayments(
      [inv('2026-08', 'overdue', '2026-08-31'), inv('2026-09', 'overdue', '2026-09-30'), inv('2026-10', 'pending', '2026-10-31')],
      TODAY,
    );
    expect(s.state).toBe('overdue');
    expect(s.overdueMonths).toBe(2);
    expect(s.daysOverdue).toBe(50);
    expect(s.totalOwedCLP).toBe(90000);
    expect(s.nextDueDate).toBe('2026-08-31');
  });

  it('trata como vencida una cuota pendiente cuyo vencimiento ya pasó, aunque el proceso no la haya marcado', () => {
    const s = summarizePayments([inv('2026-09', 'pending', '2026-09-30')], TODAY);
    expect(s.state).toBe('overdue');
    expect(s.daysOverdue).toBe(20);
  });

  it('vence el mismo día sin estar atrasada: el día del vencimiento todavía es pendiente', () => {
    const s = summarizePayments([inv('2026-10', 'pending', TODAY)], TODAY);
    expect(s.state).toBe('pending');
  });

  it('sin cuotas por delante no tiene próximo vencimiento', () => {
    expect(summarizePayments([inv('2026-10', 'paid')], TODAY).nextDueDate).toBeNull();
  });
});
