import { BillingService } from './billing.service';

// Hoy es 2026-10-15 en Chile: el mes siguiente es 2026-11.
jest.mock('../common/chile-date', () => ({ todayInChile: () => '2026-10-15' }));

const USER_ID = 'pat-1';

const overdue = (month: string, id: string) => ({
  id,
  userId: USER_ID,
  month,
  amountCLP: 30000,
  status: 'overdue',
  dueDate: `${month}-30`,
  paidAt: null,
  createdAt: new Date('2026-08-01'),
});

describe('BillingService.pay — comportamiento actual', () => {
  let service: BillingService;
  let invoiceRepo: { find: jest.Mock; findOne: jest.Mock; save: jest.Mock; create: jest.Mock; update: jest.Mock };
  let userRepo: { findOne: jest.Mock; update: jest.Mock };
  let notifRepo: { create: jest.Mock; save: jest.Mock };
  let invoices: ReturnType<typeof overdue>[];

  beforeEach(() => {
    invoices = [overdue('2026-08', 'inv-8'), overdue('2026-09', 'inv-9')];
    invoiceRepo = {
      find: jest.fn(({ where }: { where: { status?: string } }) =>
        Promise.resolve(invoices.filter((i) => !where.status || i.status === where.status)),
      ),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((v) => Promise.resolve(v)),
      create: jest.fn((v) => v),
      update: jest.fn().mockResolvedValue({ affected: 2 }),
    };
    userRepo = {
      findOne: jest.fn().mockResolvedValue({ id: USER_ID, accountStatus: 'suspended' }),
      update: jest.fn().mockResolvedValue(undefined),
    };
    notifRepo = { create: jest.fn((v) => v), save: jest.fn().mockResolvedValue(undefined) };
    service = new BillingService(invoiceRepo as any, userRepo as any, notifRepo as any, { get: jest.fn() } as any);
  });

  it('marca como pagadas todas las cuotas vencidas y reactiva la cuenta', async () => {
    await service.pay(USER_ID);

    const savedAsPaid = invoiceRepo.save.mock.calls
      .map(([arg]) => arg)
      .flat()
      .filter((i: { status: string }) => i.status === 'paid');
    const updatedAsPaid = invoiceRepo.update.mock.calls.filter(([, set]) => set.status === 'paid');
    expect(savedAsPaid.length + updatedAsPaid.length).toBeGreaterThan(0);
    expect(userRepo.update).toHaveBeenCalledWith(USER_ID, { accountStatus: 'active' });
  });

  it('crea la cuota del mes siguiente, con vencimiento el último día, si no existe', async () => {
    await service.pay(USER_ID);

    expect(invoiceRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        month: '2026-11',
        amountCLP: 30000,
        status: 'pending',
        dueDate: '2026-11-30',
      }),
    );
  });

  it('no duplica la cuota del mes siguiente si ya existe', async () => {
    invoiceRepo.findOne.mockResolvedValue({ id: 'inv-11', month: '2026-11' });

    await service.pay(USER_ID);

    expect(invoiceRepo.create).not.toHaveBeenCalled();
  });

  it('avisa al paciente que la cuenta quedó reactivada', async () => {
    await service.pay(USER_ID);

    expect(notifRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, type: 'success', title: '¡Cuenta reactivada!' }),
    );
  });

  it('con un usuario inexistente responde 404 y no toca nada', async () => {
    userRepo.findOne.mockResolvedValue(null);

    await expect(service.pay('nadie')).rejects.toThrow('Usuario no encontrado');
    expect(userRepo.update).not.toHaveBeenCalled();
    expect(notifRepo.save).not.toHaveBeenCalled();
  });
});

describe('BillingService.settleInvoices', () => {
  const pending = (month: string, id: string) => ({ ...overdue(month, id), status: 'pending' });
  let service: BillingService;
  let invoiceRepo: { find: jest.Mock; findOne: jest.Mock; save: jest.Mock; create: jest.Mock; update: jest.Mock };
  let userRepo: { update: jest.Mock };
  let notifRepo: { create: jest.Mock; save: jest.Mock };

  beforeEach(() => {
    invoiceRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ id: 'inv-11', month: '2026-11' }),
      save: jest.fn((v) => Promise.resolve(v)),
      create: jest.fn((v) => v),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    userRepo = { update: jest.fn().mockResolvedValue(undefined) };
    notifRepo = { create: jest.fn((v) => v), save: jest.fn().mockResolvedValue(undefined) };
    service = new BillingService(invoiceRepo as any, userRepo as any, notifRepo as any, { get: jest.fn() } as any);
  });

  it('un cobro real avisa «Recibimos tu pago» con el mes y destino de pagos, no «cuenta reactivada»', async () => {
    await service.settleInvoices(USER_ID, [pending('2026-10', 'inv-10')] as any, { notification: 'payment', reactivateAccount: true });

    expect(notifRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        title: 'Recibimos tu pago',
        body: expect.stringContaining('2026-10'),
        target: 'payment',
      }),
    );
  });

  it('marca pagada solo si no lo estaba ya: el update es condicional', async () => {
    await service.settleInvoices(USER_ID, [pending('2026-10', 'inv-10')] as any, { notification: 'payment', reactivateAccount: true });

    const [where, set] = invoiceRepo.update.mock.calls[0];
    expect(where).toEqual(expect.objectContaining({ userId: USER_ID, status: expect.anything() }));
    expect(set).toEqual(expect.objectContaining({ status: 'paid', paidAt: expect.any(Date) }));
  });

  it('no reactiva la cuenta si todavía debe cuotas de meses anteriores', async () => {
    invoiceRepo.find.mockResolvedValue([overdue('2026-08', 'inv-8'), overdue('2026-09', 'inv-9')]);

    await service.settleInvoices(USER_ID, [overdue('2026-09', 'inv-9')] as any, { notification: 'payment', reactivateAccount: true });

    expect(userRepo.update).not.toHaveBeenCalled();
  });

  it('reactiva la cuenta cuando salda la última cuota vencida', async () => {
    invoiceRepo.find.mockResolvedValue([overdue('2026-09', 'inv-9')]);

    await service.settleInvoices(USER_ID, [overdue('2026-09', 'inv-9')] as any, { notification: 'payment', reactivateAccount: true });

    expect(userRepo.update).toHaveBeenCalledWith(USER_ID, { accountStatus: 'active' });
  });

  // Un cobro real lo dispara el backend sin sesión. Una cuenta suspendida no puede iniciar sesión
  // porque alguien cerró su acceso: que un cobro la reabriera pasaría por encima de esa decisión.
  it('con reactivateAccount en false nunca reactiva la cuenta, ni siquiera sin cuotas vencidas', async () => {
    invoiceRepo.find.mockResolvedValue([]);

    await service.settleInvoices(USER_ID, [pending('2026-10', 'inv-10')] as any, { notification: 'payment', reactivateAccount: false });

    expect(userRepo.update).not.toHaveBeenCalled();
    expect(invoiceRepo.update).toHaveBeenCalled();
  });

  it('dentro de una transacción usa los repositorios del manager y no los del servicio', async () => {
    const txInvoiceRepo = { ...invoiceRepo, update: jest.fn().mockResolvedValue({ affected: 1 }) };
    const txUserRepo = { update: jest.fn() };
    const txNotifRepo = { create: jest.fn((v) => v), save: jest.fn() };
    const manager = {
      getRepository: jest.fn((entity: { name: string }) =>
        entity.name === 'Invoice' ? txInvoiceRepo : entity.name === 'User' ? txUserRepo : txNotifRepo,
      ),
    };

    await service.settleInvoices(USER_ID, [pending('2026-10', 'inv-10')] as any, {
      notification: 'payment',
      reactivateAccount: true,
      manager: manager as any,
    });

    expect(txInvoiceRepo.update).toHaveBeenCalled();
    expect(txNotifRepo.save).toHaveBeenCalled();
    expect(invoiceRepo.update).not.toHaveBeenCalled();
    expect(notifRepo.save).not.toHaveBeenCalled();
  });
});
