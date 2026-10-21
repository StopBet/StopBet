import { AuthUser } from '@stopbet/shared-types';
import { BillingOverviewService } from './billing-overview.service';

jest.mock('../common/chile-date', () => ({ todayInChile: () => '2026-10-20' }));

const patient = (id: string, lastName: string) => ({ id, firstName: 'Paciente', lastName, sedeId: 'Santiago' });
const invoice = (userId: string, month: string, status: string, dueDate: string) => ({
  userId,
  month,
  amountCLP: 30000,
  status,
  dueDate,
});

describe('BillingOverviewService.listPatients (HdU09)', () => {
  const psychologist = { id: 'psy-1', role: 'psychologist' } as AuthUser;
  const coordinator = { id: 'coo-1', role: 'coordinator' } as AuthUser;

  let userFind: jest.Mock;
  let invoiceFind: jest.Mock;
  let assignmentFind: jest.Mock;
  let service: BillingOverviewService;

  beforeEach(() => {
    userFind = jest.fn().mockResolvedValue([
      patient('p-al-dia', 'Rojas'),
      patient('p-poco', 'Vega'),
      patient('p-mucho', 'Soto'),
      patient('p-pendiente', 'Lagos'),
      patient('p-sin-cuotas', 'Muñoz'),
    ]);
    invoiceFind = jest.fn().mockResolvedValue([
      invoice('p-al-dia', '2026-10', 'paid', '2026-10-31'),
      invoice('p-poco', '2026-09', 'overdue', '2026-09-30'),
      invoice('p-mucho', '2026-07', 'overdue', '2026-07-31'),
      invoice('p-mucho', '2026-08', 'overdue', '2026-08-31'),
      invoice('p-pendiente', '2026-10', 'pending', '2026-10-31'),
    ]);
    assignmentFind = jest.fn().mockResolvedValue([{ patientId: 'p-poco' }, { patientId: 'p-mucho' }]);
    service = new BillingOverviewService(
      { find: invoiceFind } as never,
      { find: userFind } as never,
      { find: assignmentFind } as never,
    );
  });

  it('ordena vencidos de más a menos días de atraso, después pendientes y al final los al día (CA2)', async () => {
    const rows = await service.listPatients(coordinator);
    expect(rows.map((r) => r.patientId)).toEqual(['p-mucho', 'p-poco', 'p-pendiente', 'p-al-dia']);
    expect(rows.map((r) => r.state)).toEqual(['overdue', 'overdue', 'pending', 'up_to_date']);
    expect(rows[0].daysOverdue).toBeGreaterThan(rows[1].daysOverdue);
  });

  it('deja fuera a quien no tiene ninguna cuota (CA3)', async () => {
    const rows = await service.listPatients(coordinator);
    expect(rows.find((r) => r.patientId === 'p-sin-cuotas')).toBeUndefined();
  });

  it('la coordinación no pasa por las asignaciones', async () => {
    await service.listPatients(coordinator);
    expect(assignmentFind).not.toHaveBeenCalled();
  });

  it('un psicólogo solo consulta a sus asignados', async () => {
    await service.listPatients(psychologist);
    const where = userFind.mock.calls[0][0].where as Array<{ id: { value: string[] } }>;
    expect(where.every((w) => JSON.stringify(w.id.value) === JSON.stringify(['p-poco', 'p-mucho']))).toBe(true);
  });

  it('un psicólogo sin asignados recibe una lista vacía sin consultar pacientes', async () => {
    assignmentFind.mockResolvedValueOnce([]);
    expect(await service.listPatients(psychologist)).toEqual([]);
    expect(userFind).not.toHaveBeenCalled();
  });
});
