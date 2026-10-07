import { ConflictException, Logger } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { PaymentCharge } from './entities/payment-charge.entity';
import { answeredWithClientError, newBuyOrder, OneclickPaymentsService } from './oneclick-payments.service';

const USER_ID = 'pat-1';
const EMAIL = 'carlos@stopbet.cl';
const TBK_USER = 'tbk-user-secreto';

const invoice = (over: Record<string, unknown> = {}) => ({
  id: 'inv-10',
  userId: USER_ID,
  month: '2026-10',
  amountCLP: 30000,
  status: 'pending',
  dueDate: '2026-10-31',
  ...over,
});

const activeInscription = {
  id: 'insc-1',
  userId: USER_ID,
  username: USER_ID,
  status: 'active',
  tbkUser: TBK_USER,
  cardType: 'Visa',
  cardLast4: '6623',
  createdAt: new Date('2026-10-07T15:00:00Z'),
};

const approved = {
  approved: true,
  status: 'AUTHORIZED',
  responseCode: 0,
  authorizationCode: '1213',
  paymentTypeCode: 'VN',
  installments: 1,
  transactionDate: new Date('2026-10-07T18:00:00Z'),
};
const rejected = { ...approved, approved: false, status: 'FAILED', responseCode: -1, authorizationCode: null };

const uniqueViolation = () =>
  Object.assign(new QueryFailedError('INSERT', [], new Error('duplicate')), { driverError: { code: '23505' } });

describe('OneclickPaymentsService', () => {
  let service: OneclickPaymentsService;
  let inscriptionRepo: { findOne: jest.Mock; find: jest.Mock; save: jest.Mock; create: jest.Mock; update: jest.Mock };
  let chargeRepo: { findOne: jest.Mock; find: jest.Mock; save: jest.Mock; create: jest.Mock; update: jest.Mock };
  let invoiceRepo: { findOne: jest.Mock; find: jest.Mock };
  let userRepo: { findOne: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let gateway: Record<'isEnabled' | 'startInscription' | 'finishInscription' | 'deleteInscription' | 'authorize' | 'chargeStatus', jest.Mock>;
  let billing: { settleInvoices: jest.Mock };
  let env: Record<string, string>;
  let stored: Record<string, any> | null;

  beforeEach(() => {
    stored = null;
    env = {};
    inscriptionRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn((v) => Promise.resolve({ id: 'insc-new', createdAt: new Date(), ...v })),
      create: jest.fn((v) => v),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    // Repositorio de cobros con estado: el update condicional se comporta como en la base.
    chargeRepo = {
      findOne: jest.fn(() => Promise.resolve(stored)),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((v) => v),
      save: jest.fn((v) => {
        stored = { id: 'charge-1', createdAt: new Date('2026-10-07T18:00:00Z'), transactionDate: null, ...v };
        return Promise.resolve(stored);
      }),
      update: jest.fn((where: { id: string; status?: string }, set: Record<string, unknown>) => {
        if (stored && stored.id === where.id && (!where.status || stored.status === where.status)) {
          Object.assign(stored, set);
          return Promise.resolve({ affected: 1 });
        }
        return Promise.resolve({ affected: 0 });
      }),
    };
    invoiceRepo = {
      findOne: jest.fn().mockResolvedValue(invoice()),
      find: jest.fn().mockResolvedValue([invoice()]),
    };
    userRepo = { findOne: jest.fn().mockResolvedValue({ id: USER_ID, email: EMAIL }) };
    const manager = { getRepository: jest.fn((entity: unknown) => (entity === PaymentCharge ? chargeRepo : {})) };
    dataSource = { transaction: jest.fn((run: (m: unknown) => Promise<unknown>) => run(manager)) };
    gateway = {
      isEnabled: jest.fn().mockReturnValue(true),
      startInscription: jest.fn().mockResolvedValue({ token: 'TOKEN123', urlWebpay: 'https://webpay3gint.transbank.cl/f' }),
      finishInscription: jest.fn(),
      deleteInscription: jest.fn().mockResolvedValue(undefined),
      authorize: jest.fn().mockResolvedValue(approved),
      chargeStatus: jest.fn(),
    };
    billing = { settleInvoices: jest.fn().mockResolvedValue(undefined) };

    service = new OneclickPaymentsService(
      inscriptionRepo as any,
      chargeRepo as any,
      invoiceRepo as any,
      userRepo as any,
      dataSource as any,
      gateway as any,
      billing as any,
      { get: (key: string) => env[key] } as any,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  // ── Inscripción ────────────────────────────────────────────────────────────────────────

  describe('startInscription', () => {
    it('crea una inscripción pendiente con el id del paciente como usuario y devuelve el formulario', async () => {
      const result = await service.startInscription(USER_ID);

      expect(result).toEqual({
        inscriptionId: 'insc-new',
        token: 'TOKEN123',
        urlWebpay: 'https://webpay3gint.transbank.cl/f',
      });
      expect(inscriptionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: USER_ID, username: USER_ID, token: 'TOKEN123', status: 'pending' }),
      );
      expect(gateway.startInscription).toHaveBeenCalledWith(USER_ID, EMAIL, expect.stringContaining('/payments/oneclick/inscriptions/return'));
    });

    it('la URL de retorno sale de BACKEND_PUBLIC_URL, sin barra final', async () => {
      env.BACKEND_PUBLIC_URL = 'https://stopbet.example.com/';

      await service.startInscription(USER_ID);

      expect(gateway.startInscription.mock.calls[0][2]).toBe('https://stopbet.example.com/payments/oneclick/inscriptions/return');
    });

    it('409 si ya tiene una tarjeta activa, sin llamar a Transbank', async () => {
      inscriptionRepo.findOne.mockResolvedValue(activeInscription);

      await expect(service.startInscription(USER_ID)).rejects.toThrow('Ya tienes una tarjeta inscrita');
      expect(gateway.startInscription).not.toHaveBeenCalled();
    });

    it('503 si los pagos no están configurados', async () => {
      gateway.isEnabled.mockReturnValue(false);

      await expect(service.startInscription(USER_ID)).rejects.toThrow('Los pagos no están configurados');
    });
  });

  describe('finishInscription', () => {
    const pending = { id: 'insc-1', username: USER_ID, status: 'pending' };

    beforeEach(() => inscriptionRepo.findOne.mockResolvedValue(pending));

    it('aprobada: queda activa con el tbkUser, el tipo y los últimos 4 dígitos', async () => {
      gateway.finishInscription.mockResolvedValue({
        approved: true,
        responseCode: 0,
        tbkUser: TBK_USER,
        cardType: 'Visa',
        cardLast4: '6623',
        authorizationCode: '123456',
      });

      const outcome = await service.finishInscription({ token: 'TOKEN123', abortedBuyOrder: null, abortedSessionId: null });

      expect(outcome).toBe('ok');
      expect(inscriptionRepo.update).toHaveBeenCalledWith(
        { id: 'insc-1', status: 'pending' },
        expect.objectContaining({ status: 'active', tbkUser: TBK_USER, cardType: 'Visa', cardLast4: '6623' }),
      );
    });

    it('rechazada por el banco: queda fallida y no guarda credencial', async () => {
      gateway.finishInscription.mockResolvedValue({
        approved: false,
        responseCode: -1,
        tbkUser: null,
        cardType: null,
        cardLast4: null,
        authorizationCode: null,
      });

      const outcome = await service.finishInscription({ token: 'TOKEN123', abortedBuyOrder: null, abortedSessionId: null });

      expect(outcome).toBe('rechazada');
      expect(inscriptionRepo.update).toHaveBeenCalledWith(
        { id: 'insc-1', status: 'pending' },
        expect.objectContaining({ status: 'failed', responseCode: -1 }),
      );
    });

    it('si el paciente anuló en el formulario, queda anulada y no se cierra con Transbank', async () => {
      const outcome = await service.finishInscription({ token: 'TOKEN123', abortedBuyOrder: 'SB123', abortedSessionId: 's' });

      expect(outcome).toBe('anulada');
      expect(gateway.finishInscription).not.toHaveBeenCalled();
      expect(inscriptionRepo.update).toHaveBeenCalledWith(
        { id: 'insc-1', status: 'pending' },
        expect.objectContaining({ status: 'aborted' }),
      );
    });

    it('un token desconocido responde error sin llamar a Transbank', async () => {
      inscriptionRepo.findOne.mockResolvedValue(null);

      expect(await service.finishInscription({ token: 'NOSE', abortedBuyOrder: null, abortedSessionId: null })).toBe('error');
      expect(gateway.finishInscription).not.toHaveBeenCalled();
    });

    it('sin token responde error', async () => {
      expect(await service.finishInscription({ token: null, abortedBuyOrder: null, abortedSessionId: null })).toBe('error');
    });

    // Recargar la página de retorno no debe volver a cerrar con Transbank: el token ya se consumió.
    it('es idempotente: un token ya usado repite el resultado sin llamar a Transbank', async () => {
      inscriptionRepo.findOne.mockResolvedValue({ ...pending, status: 'active' });

      expect(await service.finishInscription({ token: 'TOKEN123', abortedBuyOrder: null, abortedSessionId: null })).toBe('ok');
      expect(gateway.finishInscription).not.toHaveBeenCalled();
    });

    it('si Transbank falla (por ejemplo pasaron los 60 s), queda fallida y no lanza', async () => {
      gateway.finishInscription.mockRejectedValue(new Error('timeout'));

      const outcome = await service.finishInscription({ token: 'TOKEN123', abortedBuyOrder: null, abortedSessionId: null });

      expect(outcome).toBe('error');
      expect(inscriptionRepo.update).toHaveBeenCalledWith({ id: 'insc-1', status: 'pending' }, expect.objectContaining({ status: 'failed' }));
    });

    it('si otra tarjeta del paciente se activó mientras tanto, borra la de Transbank y no deja dos activas', async () => {
      gateway.finishInscription.mockResolvedValue({
        approved: true,
        responseCode: 0,
        tbkUser: TBK_USER,
        cardType: 'Visa',
        cardLast4: '6623',
        authorizationCode: '1',
      });
      inscriptionRepo.update.mockRejectedValueOnce(uniqueViolation());

      const outcome = await service.finishInscription({ token: 'TOKEN123', abortedBuyOrder: null, abortedSessionId: null });

      expect(outcome).toBe('error');
      expect(gateway.deleteInscription).toHaveBeenCalledWith(TBK_USER, USER_ID);
    });
  });

  describe('deleteInscription', () => {
    it('la borra en Transbank y la marca eliminada', async () => {
      inscriptionRepo.findOne.mockResolvedValue(activeInscription);

      await service.deleteInscription(USER_ID);

      expect(gateway.deleteInscription).toHaveBeenCalledWith(TBK_USER, USER_ID);
      expect(inscriptionRepo.update).toHaveBeenCalledWith({ id: 'insc-1' }, expect.objectContaining({ status: 'deleted' }));
    });

    it('si Transbank no la borra, no la marca eliminada: seguiría existiendo allá', async () => {
      inscriptionRepo.findOne.mockResolvedValue(activeInscription);
      gateway.deleteInscription.mockRejectedValue(new Error('red'));

      await expect(service.deleteInscription(USER_ID)).rejects.toThrow('No pudimos eliminar la tarjeta');
      expect(inscriptionRepo.update).not.toHaveBeenCalled();
    });

    it('404 si no tiene tarjeta', async () => {
      await expect(service.deleteInscription(USER_ID)).rejects.toThrow('No tienes una tarjeta inscrita');
    });
  });

  // ── Cobros ─────────────────────────────────────────────────────────────────────────────

  describe('chargeInvoice', () => {
    beforeEach(() => inscriptionRepo.findOne.mockResolvedValue(activeInscription));

    it('cobro autorizado: la cuota se salda en la misma transacción y el cobro queda autorizado', async () => {
      const view = await service.chargeInvoice(USER_ID, 'user', 'inv-10');

      expect(view).toMatchObject({ status: 'authorized', triggeredBy: 'user', amountCLP: 30000, responseCode: 0, authorizationCode: '1213' });
      expect(dataSource.transaction).toHaveBeenCalled();
      expect(billing.settleInvoices).toHaveBeenCalledWith(USER_ID, [expect.objectContaining({ id: 'inv-10' })], {
        notification: 'payment',
        manager: expect.anything(),
      });
    });

    it('guarda quién lo disparó: el cobro automático queda como automático', async () => {
      const view = await service.chargeInvoice(USER_ID, 'automatic', 'inv-10');

      expect(view.triggeredBy).toBe('automatic');
    });

    it('manda a Transbank el tbkUser, el monto y órdenes de compra válidas', async () => {
      await service.chargeInvoice(USER_ID, 'user', 'inv-10');

      const request = gateway.authorize.mock.calls[0][0];
      expect(request).toMatchObject({ username: USER_ID, tbkUser: TBK_USER, amountCLP: 30000 });
      for (const order of [request.parentBuyOrder, request.childBuyOrder]) {
        expect(order).toMatch(/^[A-Z0-9]{1,26}$/);
      }
      expect(request.childBuyOrder).not.toBe(request.parentBuyOrder);
    });

    it('rechazado por el banco: el cobro queda rechazado y la cuota sigue sin pagar', async () => {
      gateway.authorize.mockResolvedValue(rejected);

      const view = await service.chargeInvoice(USER_ID, 'user', 'inv-10');

      expect(view).toMatchObject({ status: 'rejected', responseCode: -1 });
      expect(billing.settleInvoices).not.toHaveBeenCalled();
    });

    it('sin tarjeta inscrita responde 409 sin tocar nada', async () => {
      inscriptionRepo.findOne.mockResolvedValue(null);

      await expect(service.chargeInvoice(USER_ID, 'user')).rejects.toThrow('Primero inscribe una tarjeta');
      expect(chargeRepo.save).not.toHaveBeenCalled();
    });

    it('una cuota ya pagada responde 409 sin llamar a Transbank', async () => {
      invoiceRepo.findOne.mockResolvedValue(invoice({ status: 'paid' }));

      await expect(service.chargeInvoice(USER_ID, 'user', 'inv-10')).rejects.toThrow('Esa cuota ya está pagada');
      expect(gateway.authorize).not.toHaveBeenCalled();
    });

    it('sin indicar cuota cobra la más antigua que esté sin pagar', async () => {
      await service.chargeInvoice(USER_ID, 'user');

      expect(invoiceRepo.find).toHaveBeenCalledWith(expect.objectContaining({ order: { dueDate: 'ASC' }, take: 1 }));
    });

    it('404 si no hay cuotas por pagar', async () => {
      invoiceRepo.find.mockResolvedValue([]);

      await expect(service.chargeInvoice(USER_ID, 'user')).rejects.toThrow('No tienes cuotas por pagar');
    });

    // Dos pedidos a la vez por la misma cuota: el índice único de la base hace perder al segundo
    // ANTES de llamar a Transbank, así que la tarjeta no se cobra dos veces.
    it('si otro cobro ya tiene tomada la cuota, responde 409 y nunca llama a Transbank', async () => {
      chargeRepo.save.mockRejectedValueOnce(uniqueViolation());

      await expect(service.chargeInvoice(USER_ID, 'user', 'inv-10')).rejects.toThrow(ConflictException);
      expect(gateway.authorize).not.toHaveBeenCalled();
    });

    it('el cobro se inserta ANTES de llamar a Transbank', async () => {
      const order: string[] = [];
      chargeRepo.save.mockImplementationOnce((v) => {
        order.push('insert');
        stored = { id: 'charge-1', createdAt: new Date(), transactionDate: null, ...v };
        return Promise.resolve(stored);
      });
      gateway.authorize.mockImplementationOnce(() => {
        order.push('authorize');
        return Promise.resolve(approved);
      });

      await service.chargeInvoice(USER_ID, 'user', 'inv-10');

      expect(order).toEqual(['insert', 'authorize']);
    });

    describe('cuando el cobro a Transbank falla', () => {
      it('con un 4xx de Transbank no se cobró: queda como error y la cuota queda libre', async () => {
        gateway.authorize.mockRejectedValue(new Error('Request failed with status code 422\n-96 - tbk_user inexistente'));

        const view = await service.chargeInvoice(USER_ID, 'user', 'inv-10');

        expect(view.status).toBe('error');
        expect(gateway.chargeStatus).not.toHaveBeenCalled();
        expect(billing.settleInvoices).not.toHaveBeenCalled();
      });

      it('con un corte de red consulta a Transbank, y si sí se cobró, salda la cuota', async () => {
        gateway.authorize.mockRejectedValue(new Error('timeout of 5000ms exceeded'));
        gateway.chargeStatus.mockResolvedValue(approved);

        const view = await service.chargeInvoice(USER_ID, 'user', 'inv-10');

        expect(view.status).toBe('authorized');
        expect(gateway.chargeStatus).toHaveBeenCalledWith(expect.stringMatching(/^SB/));
        expect(billing.settleInvoices).toHaveBeenCalled();
      });

      it('con un corte de red y Transbank diciendo que fue rechazado, queda rechazado', async () => {
        gateway.authorize.mockRejectedValue(new Error('socket hang up'));
        gateway.chargeStatus.mockResolvedValue(rejected);

        expect((await service.chargeInvoice(USER_ID, 'user', 'inv-10')).status).toBe('rejected');
        expect(billing.settleInvoices).not.toHaveBeenCalled();
      });

      it('con un corte de red y Transbank sin conocer esa orden, nunca se cobró: error', async () => {
        gateway.authorize.mockRejectedValue(new Error('socket hang up'));
        gateway.chargeStatus.mockRejectedValue(new Error('Request failed with status code 404'));

        expect((await service.chargeInvoice(USER_ID, 'user', 'inv-10')).status).toBe('error');
      });

      // Liberar la cuota arriesga cobrarle dos veces a quien sí pagó: queda bloqueada hasta conciliar.
      it('si ni siquiera se puede consultar, queda en curso y la cuota bloqueada', async () => {
        gateway.authorize.mockRejectedValue(new Error('socket hang up'));
        gateway.chargeStatus.mockRejectedValue(new Error('socket hang up'));
        jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

        const view = await service.chargeInvoice(USER_ID, 'user', 'inv-10');

        expect(view.status).toBe('processing');
        expect(billing.settleInvoices).not.toHaveBeenCalled();
      });
    });

    it('no escribe en los logs el correo ni el tbkUser', async () => {
      const spies = (['log', 'warn', 'error'] as const).map((m) => jest.spyOn(Logger.prototype, m).mockImplementation(() => undefined));
      gateway.authorize.mockResolvedValueOnce(rejected);
      await service.chargeInvoice(USER_ID, 'user', 'inv-10');
      inscriptionRepo.findOne.mockResolvedValue({ id: 'insc-1', username: USER_ID, status: 'pending' });
      gateway.finishInscription.mockResolvedValue({ approved: true, responseCode: 0, tbkUser: TBK_USER, cardType: 'Visa', cardLast4: '6623', authorizationCode: '1' });
      await service.finishInscription({ token: 'TOKEN123', abortedBuyOrder: null, abortedSessionId: null });

      const written = spies.flatMap((s) => s.mock.calls.map((c) => String(c[0]))).join('\n');
      expect(written).not.toContain(EMAIL);
      expect(written).not.toContain(TBK_USER);
      expect(written).not.toContain('TOKEN123');
    });
  });

  // ── Cobro automático (el segundo cobro del CA6) ───────────────────────────────────────────

  describe('chargeDueInvoices', () => {
    it('sin tarjetas inscritas no hace nada', async () => {
      expect(await service.chargeDueInvoices('2026-11-30')).toEqual([]);
      expect(invoiceRepo.find).not.toHaveBeenCalled();
    });

    describe('con una tarjeta inscrita', () => {
      beforeEach(() => {
        inscriptionRepo.find.mockResolvedValue([activeInscription]);
        inscriptionRepo.findOne.mockResolvedValue(activeInscription);
        invoiceRepo.find.mockResolvedValue([invoice()]);
        invoiceRepo.findOne.mockResolvedValue(invoice());
      });

      it('cobra sin que haya sesión de nadie y lo deja como automático', async () => {
        const summary = await service.chargeDueInvoices('2026-11-30');

        expect(summary).toEqual([
          expect.objectContaining({ invoiceId: 'inv-10', month: '2026-10', result: 'authorized', authorizationCode: '1213' }),
        ]);
        expect(chargeRepo.create).toHaveBeenCalledWith(expect.objectContaining({ triggeredBy: 'automatic', userId: USER_ID }));
      });

      it('solo busca cuotas de quienes tienen tarjeta y que vencen hasta la fecha', async () => {
        await service.chargeDueInvoices('2026-11-30');

        const where = invoiceRepo.find.mock.calls[0][0].where;
        expect(where.userId.value).toEqual([USER_ID]);
        expect(where.dueDate.value).toBe('2026-11-30');
      });

      it('un cobro que falla no frena al resto del lote', async () => {
        jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
        invoiceRepo.find.mockResolvedValue([invoice({ id: 'inv-a' }), invoice({ id: 'inv-b' })]);
        invoiceRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(invoice({ id: 'inv-b' }));

        const summary = await service.chargeDueInvoices('2026-11-30');

        expect(summary.map((s) => [s.invoiceId, s.result])).toEqual([
          ['inv-a', 'error'],
          ['inv-b', 'authorized'],
        ]);
      });

      it('una cuota que ya tiene su cobro aparece como omitida, no como error', async () => {
        chargeRepo.save.mockRejectedValueOnce(uniqueViolation());

        const summary = await service.chargeDueInvoices('2026-11-30');

        expect(summary[0].result).toBe('skipped');
      });

      // Correr dos veces el mismo día no cobra dos veces: la segunda no encuentra cuotas pendientes.
      it('una segunda corrida, con la cuota ya pagada, no cobra nada', async () => {
        invoiceRepo.find.mockResolvedValue([]);

        expect(await service.chargeDueInvoices('2026-11-30')).toEqual([]);
        expect(gateway.authorize).not.toHaveBeenCalled();
      });
    });
  });

  describe('runScheduledCharges (cron)', () => {
    it('está apagado por omisión: no cobra aunque haya cuotas', async () => {
      inscriptionRepo.find.mockResolvedValue([activeInscription]);

      await service.runScheduledCharges();

      expect(gateway.authorize).not.toHaveBeenCalled();
    });

    it('con TBK_AUTO_CHARGE_CRON=true cobra las cuotas vencidas', async () => {
      env.TBK_AUTO_CHARGE_CRON = 'true';
      inscriptionRepo.find.mockResolvedValue([activeInscription]);
      inscriptionRepo.findOne.mockResolvedValue(activeInscription);

      await service.runScheduledCharges();

      expect(gateway.authorize).toHaveBeenCalledTimes(1);
    });

    it('con los pagos sin configurar no hace nada', async () => {
      env.TBK_AUTO_CHARGE_CRON = 'true';
      gateway.isEnabled.mockReturnValue(false);

      await service.runScheduledCharges();

      expect(inscriptionRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('transbankStatus', () => {
    it('devuelve lo que Transbank dice del cobro, buscándolo por la orden de compra padre', async () => {
      chargeRepo.findOne.mockResolvedValueOnce({ id: 'charge-1', parentBuyOrder: 'SBABC' });
      gateway.chargeStatus.mockResolvedValue(approved);

      const view = await service.transbankStatus('charge-1');

      expect(gateway.chargeStatus).toHaveBeenCalledWith('SBABC');
      expect(view).toMatchObject({ buyOrder: 'SBABC', approved: true, status: 'AUTHORIZED', authorizationCode: '1213' });
    });

    it('404 si el cobro no existe', async () => {
      chargeRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.transbankStatus('nada')).rejects.toThrow('Cobro no encontrado');
    });
  });
});

describe('answeredWithClientError', () => {
  it.each([
    ['422', 'Request failed with status code 422\n-96 - tbk_user inexistente', true],
    ['404', 'Request failed with status code 404', true],
    ['401', 'Request failed with status code 401', true],
    ['500', 'Request failed with status code 500', false],
    ['un timeout', 'timeout of 5000ms exceeded', false],
    ['un corte de red', 'socket hang up', false],
  ])('%s', (_caso, message, expected) => {
    expect(answeredWithClientError(new Error(message))).toBe(expected);
  });
});

describe('newBuyOrder', () => {
  it('cabe en los 26 caracteres de Transbank, con su sufijo de tienda, y usa solo A-Z y 0-9', () => {
    const order = newBuyOrder();

    expect(`${order}1`.length).toBeLessThanOrEqual(26);
    expect(order).toMatch(/^[A-Z0-9]+$/);
  });

  it('dos llamadas seguidas dan órdenes distintas', () => {
    const orders = new Set(Array.from({ length: 200 }, () => newBuyOrder(1_700_000_000_000)));

    expect(orders.size).toBe(200);
  });
});
