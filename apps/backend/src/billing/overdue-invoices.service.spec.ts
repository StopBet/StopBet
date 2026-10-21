import { FindOperator } from 'typeorm';
import { OverdueInvoicesService } from './overdue-invoices.service';

describe('OverdueInvoicesService (HdU09)', () => {
  let update: jest.Mock;
  let service: OverdueInvoicesService;

  beforeEach(() => {
    update = jest.fn().mockResolvedValue({ affected: 3 });
    service = new OverdueInvoicesService({ update } as never);
  });

  it('pasa a vencidas solo las cuotas pendientes cuyo vencimiento es anterior a hoy', async () => {
    const marked = await service.markOverdue('2026-11-01');

    expect(marked).toBe(3);
    const [where, changes] = update.mock.calls[0] as [{ status: string; dueDate: FindOperator<string> }, object];
    expect(where.status).toBe('pending');
    expect(where.dueDate.type).toBe('lessThan');
    expect(where.dueDate.value).toBe('2026-11-01');
    expect(changes).toEqual({ status: 'overdue' });
  });

  it('no toca la cuenta del paciente: solo marca la cuota', async () => {
    await service.markOverdue('2026-11-01');
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('un fallo al arrancar no tumba el backend', async () => {
    update.mockRejectedValueOnce(new Error('db caída'));
    expect(() => service.onApplicationBootstrap()).not.toThrow();
    await new Promise((r) => setImmediate(r));
  });
});
