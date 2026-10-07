import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { RefreshToken } from '../src/auth/entities/refresh-token.entity';
import { Invoice } from '../src/billing/entities/invoice.entity';
import { Notification } from '../src/notifications/entities/notification.entity';
import { PaymentCharge } from '../src/payments/entities/payment-charge.entity';
import { PaymentInscription } from '../src/payments/entities/payment-inscription.entity';
import { OneclickGateway } from '../src/payments/oneclick.gateway';
import { User } from '../src/users/entities/user.entity';

// SPIKE 2 CA6. El gateway de Transbank se reemplaza por uno falso, así que el spec no sale a la red
// y puede correr en CI. Lo que se prueba acá es TODO lo nuestro: rutas, roles, la redirección de
// retorno con el ValidationPipe real, la base de datos con sus índices únicos parciales y el cobro
// automático. La conversación real con Transbank se probó a mano (docs/planning/spike2-pasarela-pago.md).
//
// La BD e2e llega vacía en CI: el spec crea sus propios fixtures y los borra al terminar. Las
// cuotas llevan meses de 2020 para que el cobro automático (`asOf` 2020-12-31) solo vea las suyas.
describe('Pagos con Webpay Oneclick (e2e)', () => {
  let app: INestApplication;
  let userRepo: Repository<User>;
  let invoiceRepo: Repository<Invoice>;
  let chargeRepo: Repository<PaymentCharge>;
  let inscriptionRepo: Repository<PaymentInscription>;
  let notifRepo: Repository<Notification>;
  let refreshTokenRepo: Repository<RefreshToken>;

  const PASSWORD = 'TestE2E2026!';
  const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const userIds: string[] = [];
  const originalDevTools = process.env.ENABLE_DEV_TOOLS;

  let patient: { id: string; email: string; token: string };
  let otherPatient: { id: string; email: string; token: string };
  let attacker: { id: string; email: string; token: string };
  let coordinator: { id: string; email: string; token: string };
  let invoiceA: Invoice;
  let invoiceB: Invoice;

  const approved = {
    approved: true,
    status: 'AUTHORIZED',
    responseCode: 0,
    authorizationCode: '1213',
    paymentTypeCode: 'VN',
    installments: 1,
    transactionDate: new Date('2026-10-07T22:30:00Z'),
  };

  let tokenCounter = 0;
  const gateway = {
    isEnabled: jest.fn(),
    startInscription: jest.fn(),
    finishInscription: jest.fn(),
    deleteInscription: jest.fn(),
    authorize: jest.fn(),
    chargeStatus: jest.fn(),
  };

  function resetGateway(): void {
    jest.clearAllMocks();
    gateway.isEnabled.mockReturnValue(true);
    gateway.startInscription.mockImplementation(() => {
      tokenCounter += 1;
      return Promise.resolve({ token: `FAKETOKEN${unique().replace(/[^a-z0-9]/gi, '')}${tokenCounter}`, urlWebpay: 'https://webpay.test/form' });
    });
    gateway.finishInscription.mockResolvedValue({
      approved: true,
      responseCode: 0,
      tbkUser: `tbk-${unique()}`,
      cardType: 'Visa',
      cardLast4: '6623',
      authorizationCode: '123456',
    });
    gateway.deleteInscription.mockResolvedValue(undefined);
    gateway.authorize.mockResolvedValue(approved);
    gateway.chargeStatus.mockResolvedValue(approved);
  }

  async function createUser(role: 'patient' | 'coordinator', label: string) {
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const user = await userRepo.save(
      userRepo.create({
        email: `e2e-pay-${label}-${unique()}@stopbet.cl`,
        passwordHash,
        role,
        firstName: 'E2E',
        lastName: label,
        accountStatus: 'active',
        onboardingStatus: role === 'patient' ? 'complete' : null,
      }),
    );
    userIds.push(user.id);
    const res = await request(app.getHttpServer()).post('/auth/login').send({ email: user.email, password: PASSWORD }).expect(200);
    return { id: user.id, email: user.email, token: res.body.accessToken as string };
  }

  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });

  // Sin tarjeta, el endpoint devuelve `null`: Nest lo responde como 200 con el cuerpo vacío.
  async function cardOf(who: { token: string }): Promise<Record<string, unknown> | null> {
    const res = await http().get('/payments/oneclick/inscription').set(as(who.token)).expect(200);
    return res.text ? res.body : null;
  }

  // Lo que hace el navegador del paciente: Transbank lo devuelve a la URL de retorno, que solo
  // reenvía, y la página cierra la inscripción llamando con SU sesión.
  const finish = (who: { token: string }, params: Record<string, string>) =>
    http().post('/payments/oneclick/inscriptions/finish').set(as(who.token)).send(params);

  async function enroll(who: { token: string }): Promise<string> {
    const started = await http().post('/payments/oneclick/inscriptions').set(as(who.token)).expect(201);
    await http().get('/payments/oneclick/inscriptions/return').query({ TBK_TOKEN: started.body.token }).expect(303);
    await finish(who, { token: started.body.token }).expect(200);
    return started.body.token;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OneclickGateway)
      .useValue(gateway)
      .compile();

    app = moduleFixture.createNestApplication();
    // El mismo pipe que main.ts: es lo que haría fallar el retorno de Transbank si usara un DTO.
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    userRepo = moduleFixture.get(getRepositoryToken(User));
    invoiceRepo = moduleFixture.get(getRepositoryToken(Invoice));
    chargeRepo = moduleFixture.get(getRepositoryToken(PaymentCharge));
    inscriptionRepo = moduleFixture.get(getRepositoryToken(PaymentInscription));
    notifRepo = moduleFixture.get(getRepositoryToken(Notification));
    refreshTokenRepo = moduleFixture.get(getRepositoryToken(RefreshToken));

    process.env.ENABLE_DEV_TOOLS = 'true';
    resetGateway();

    patient = await createUser('patient', 'Paciente');
    otherPatient = await createUser('patient', 'Otro');
    attacker = await createUser('patient', 'Atacante');
    coordinator = await createUser('coordinator', 'Coordinacion');

    // Dos cuotas vencidas del paciente: la primera la paga él (cobro 1) y la segunda el backend (cobro 2).
    invoiceA = await invoiceRepo.save(
      invoiceRepo.create({ userId: patient.id, month: '2020-01', amountCLP: 30000, status: 'overdue', dueDate: '2020-01-31' }),
    );
    invoiceB = await invoiceRepo.save(
      invoiceRepo.create({ userId: patient.id, month: '2020-02', amountCLP: 30000, status: 'overdue', dueDate: '2020-02-29' }),
    );
  });

  beforeEach(() => resetGateway());

  afterAll(async () => {
    if (originalDevTools === undefined) delete process.env.ENABLE_DEV_TOOLS;
    else process.env.ENABLE_DEV_TOOLS = originalDevTools;

    for (const id of userIds) {
      // payments no tiene FK hacia users a propósito (es un registro de auditoría): se borra a mano.
      await chargeRepo.delete({ userId: id });
      await inscriptionRepo.delete({ userId: id });
      await invoiceRepo.delete({ userId: id });
      await notifRepo.delete({ userId: id });
      await refreshTokenRepo.delete({ userId: id });
      await userRepo.delete({ id });
    }
    await app.close();
  });

  // ── Permisos ──────────────────────────────────────────────────────────────────────────────

  describe('permisos', () => {
    it('sin token, 401', async () => {
      await http().post('/payments/oneclick/inscriptions').expect(401);
      await http().post('/payments/oneclick/inscriptions/finish').send({ token: 'ABC' }).expect(401);
      await http().post('/payments/oneclick/charges').send({}).expect(401);
    });

    it('la coordinación no puede inscribir ni cobrar como paciente', async () => {
      await http().post('/payments/oneclick/inscriptions').set(as(coordinator.token)).expect(403);
      await http().post('/payments/oneclick/inscriptions/finish').set(as(coordinator.token)).send({ token: 'ABC' }).expect(403);
      await http().post('/payments/oneclick/charges').set(as(coordinator.token)).send({}).expect(403);
      await http().get('/payments/oneclick/inscription').set(as(coordinator.token)).expect(403);
    });

    it('el paciente no puede usar el cobro automático ni consultar a Transbank', async () => {
      await http().post('/payments/oneclick/charges/run-due').set(as(patient.token)).send({}).expect(403);
      await http().get('/payments/oneclick/charges/00000000-0000-4000-8000-000000000000/transbank-status').set(as(patient.token)).expect(403);
    });
  });

  // ── Inscripción ───────────────────────────────────────────────────────────────────────────

  describe('inscripción de la tarjeta', () => {
    it('inicia con el id del paciente como usuario y devuelve el formulario de Transbank', async () => {
      const res = await http().post('/payments/oneclick/inscriptions').set(as(patient.token)).expect(201);

      expect(res.body).toEqual({ inscriptionId: expect.any(String), token: expect.stringMatching(/^FAKETOKEN/), urlWebpay: 'https://webpay.test/form' });
      expect(gateway.startInscription).toHaveBeenCalledWith(patient.id, patient.email, expect.stringContaining('/payments/oneclick/inscriptions/return'));
    });

    // El retorno es una redirección del navegador y no trae sesión: por sí solo no puede cerrar nada.
    it('el retorno es público, acepta parámetros desconocidos y solo reenvía el token, sin cerrar la inscripción', async () => {
      const started = await http().post('/payments/oneclick/inscriptions').set(as(patient.token)).expect(201);

      // Con un DTO, `campo_nuevo` haría que el ValidationPipe respondiera 400 al navegador.
      const res = await http()
        .get('/payments/oneclick/inscriptions/return')
        .query({ TBK_TOKEN: started.body.token, campo_nuevo: 'x' })
        .expect(303);

      expect(res.headers.location).toContain('/payments/oneclick/test-page');
      expect(res.headers.location).toContain(`TBK_TOKEN=${started.body.token}`);
      expect(res.headers.location).not.toContain('campo_nuevo');
      expect(gateway.finishInscription).not.toHaveBeenCalled();
      expect(await cardOf(patient)).toBeNull();
    });

    it('el paciente cierra la inscripción con su sesión y queda con la tarjeta', async () => {
      const [pendingInscription] = await inscriptionRepo.find({ where: { userId: patient.id, status: 'pending' }, order: { createdAt: 'DESC' } });

      const res = await finish(patient, { token: pendingInscription.token as string }).expect(200);

      expect(res.body).toEqual({ outcome: 'ok' });
      expect(gateway.finishInscription).toHaveBeenCalledTimes(1);
    });

    it('guarda solo el tipo y los últimos 4 dígitos, y el tbkUser cifrado en la base', async () => {
      const card = await http().get('/payments/oneclick/inscription').set(as(patient.token)).expect(200);

      expect(card.body).toMatchObject({ status: 'active', cardType: 'Visa', cardLast4: '6623' });
      expect(Object.keys(card.body).sort()).toEqual(['cardLast4', 'cardType', 'createdAt', 'id', 'status']);

      const [raw] = await inscriptionRepo.query(`SELECT "tbkUser" FROM payment_inscriptions WHERE "userId" = $1 AND status = 'active'`, [patient.id]);
      expect(raw.tbkUser).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/); // iv:tag:texto, nunca el valor en claro
    });

    it('una segunda tarjeta mientras hay una activa responde 409 sin llamar a Transbank', async () => {
      await http().post('/payments/oneclick/inscriptions').set(as(patient.token)).expect(409);
      expect(gateway.startInscription).not.toHaveBeenCalled();
    });

    it('cerrar de nuevo la misma inscripción repite el resultado sin llamar a Transbank', async () => {
      const token = await enroll(otherPatient);
      gateway.finishInscription.mockClear();

      const again = await finish(otherPatient, { token }).expect(200);

      expect(again.body).toEqual({ outcome: 'ok' });
      expect(gateway.finishInscription).not.toHaveBeenCalled();
    });

    it('el retorno también llega por POST con el cuerpo urlencoded', async () => {
      await http().delete('/payments/oneclick/inscription').set(as(otherPatient.token)).expect(204);
      const started = await http().post('/payments/oneclick/inscriptions').set(as(otherPatient.token)).expect(201);

      const res = await http().post('/payments/oneclick/inscriptions/return').type('form').send({ TBK_TOKEN: started.body.token }).expect(303);

      expect(res.headers.location).toContain(`TBK_TOKEN=${started.body.token}`);
      await finish(otherPatient, { token: started.body.token }).expect(200);
      expect((await cardOf(otherPatient))?.status).toBe('active');
    });

    it('si el paciente anula en Transbank, queda anulada y nunca se cierra con Transbank', async () => {
      await http().delete('/payments/oneclick/inscription').set(as(otherPatient.token)).expect(204);
      const started = await http().post('/payments/oneclick/inscriptions').set(as(otherPatient.token)).expect(201);

      const back = await http()
        .get('/payments/oneclick/inscriptions/return')
        .query({ TBK_TOKEN: started.body.token, TBK_ORDEN_COMPRA: 'SB123', TBK_ID_SESION: 'sess' })
        .expect(303);
      expect(back.headers.location).toContain('TBK_ORDEN_COMPRA=SB123');

      const res = await finish(otherPatient, { token: started.body.token, abortedBuyOrder: 'SB123', abortedSessionId: 'sess' }).expect(200);

      expect(res.body).toEqual({ outcome: 'anulada' });
      expect(gateway.finishInscription).not.toHaveBeenCalled();
      expect(await cardOf(otherPatient)).toBeNull();
    });

    // El ataque que esto cierra: quien tiene una cuenta abre una inscripción y hace que otra persona
    // complete el formulario de Transbank con SU tarjeta, para dejarla atada a la cuenta de quien
    // abrió. Con la sesión de la víctima, el token del atacante no cierra nada.
    it('una inscripción abierta por otra persona no se puede cerrar con mi sesión', async () => {
      const started = await http().post('/payments/oneclick/inscriptions').set(as(attacker.token)).expect(201);

      const asVictim = await finish(otherPatient, { token: started.body.token }).expect(200);

      expect(asVictim.body).toEqual({ outcome: 'error' });
      expect(gateway.finishInscription).not.toHaveBeenCalled();
      expect(await cardOf(attacker)).toBeNull();

      // El dueño sí puede, así que la inscripción no quedó rota.
      const asOwner = await finish(attacker, { token: started.body.token }).expect(200);
      expect(asOwner.body).toEqual({ outcome: 'ok' });
    });

    it('un token que no existe responde error, sin llamar a Transbank', async () => {
      const res = await finish(patient, { token: 'NOEXISTE' }).expect(200);

      expect(res.body).toEqual({ outcome: 'error' });
      expect(gateway.finishInscription).not.toHaveBeenCalled();
    });

    it('un cierre con un token mal formado responde 400', async () => {
      await finish(patient, { token: 'con espacios y <script>' }).expect(400);
      await http().post('/payments/oneclick/inscriptions/finish').set(as(patient.token)).send({}).expect(400);
    });

    it('un retorno sin nada también redirige, sin error', async () => {
      const res = await http().get('/payments/oneclick/inscriptions/return').expect(303);

      expect(res.headers.location).toContain('inscripcion=error');
    });

    it('con los pagos sin configurar, responde 503', async () => {
      gateway.isEnabled.mockReturnValue(false);

      await http().post('/payments/oneclick/inscriptions').set(as(otherPatient.token)).expect(503);
    });
  });

  // ── Los dos cobros del CA6 ────────────────────────────────────────────────────────────────

  describe('cobros', () => {
    it('cobro 1: el paciente paga la cuota más antigua con su tarjeta, y queda pagada en la base', async () => {
      const res = await http().post('/payments/oneclick/charges').set(as(patient.token)).send({}).expect(201);

      expect(res.body).toMatchObject({
        invoiceId: invoiceA.id,
        status: 'authorized',
        triggeredBy: 'user',
        amountCLP: 30000,
        responseCode: 0,
        authorizationCode: '1213',
      });
      expect((await invoiceRepo.findOneByOrFail({ id: invoiceA.id })).status).toBe('paid');
      expect((await invoiceRepo.findOneByOrFail({ id: invoiceB.id })).status).toBe('overdue');
    });

    it('avisa al paciente que se cobró su mensualidad', async () => {
      const notifs = await notifRepo.find({ where: { userId: patient.id, title: 'Recibimos tu pago' } });

      expect(notifs).toHaveLength(1);
      expect(notifs[0]).toMatchObject({ target: 'payment' });
    });

    it('cobrar de nuevo la misma cuota responde 409 y no llama a Transbank', async () => {
      await http().post('/payments/oneclick/charges').set(as(patient.token)).send({ invoiceId: invoiceA.id }).expect(409);

      expect(gateway.authorize).not.toHaveBeenCalled();
    });

    it('un invoiceId que no es un id válido responde 400', async () => {
      await http().post('/payments/oneclick/charges').set(as(patient.token)).send({ invoiceId: 'no-es-un-id' }).expect(400);
    });

    it('cobro 2: el backend cobra la cuota vencida SIN el paciente, y queda como automático', async () => {
      const res = await http().post('/payments/oneclick/charges/run-due').set(as(coordinator.token)).send({ asOf: '2020-12-31' }).expect(200);

      expect(res.body).toEqual([
        expect.objectContaining({ invoiceId: invoiceB.id, month: '2020-02', result: 'authorized', authorizationCode: '1213' }),
      ]);
      expect((await invoiceRepo.findOneByOrFail({ id: invoiceB.id })).status).toBe('paid');

      const [charge] = await chargeRepo.find({ where: { invoiceId: invoiceB.id } });
      expect(charge.triggeredBy).toBe('automatic');
    });

    it('una segunda corrida del cobro automático no cobra nada más', async () => {
      gateway.authorize.mockClear();

      const res = await http().post('/payments/oneclick/charges/run-due').set(as(coordinator.token)).send({ asOf: '2020-12-31' }).expect(200);

      expect(res.body).toEqual([]);
      expect(gateway.authorize).not.toHaveBeenCalled();
    });

    it('lista los cobros del paciente, el más reciente primero', async () => {
      const res = await http().get('/payments/oneclick/charges').set(as(patient.token)).expect(200);

      expect(res.body.map((c: { triggeredBy: string }) => c.triggeredBy)).toEqual(['automatic', 'user']);
    });

    it('la coordinación puede pedirle a Transbank el estado de un cobro, por la orden de compra padre', async () => {
      const [charge] = await chargeRepo.find({ where: { invoiceId: invoiceA.id } });

      const res = await http().get(`/payments/oneclick/charges/${charge.id}/transbank-status`).set(as(coordinator.token)).expect(200);

      expect(gateway.chargeStatus).toHaveBeenCalledWith(charge.parentBuyOrder);
      expect(res.body).toMatchObject({ buyOrder: charge.parentBuyOrder, approved: true, status: 'AUTHORIZED' });
    });

    it('un id de cobro que no es un UUID responde 400', async () => {
      await http().get('/payments/oneclick/charges/no-es-uuid/transbank-status').set(as(coordinator.token)).expect(400);
    });
  });

  // ── Cuenta suspendida ─────────────────────────────────────────────────────────────────────

  describe('cuenta suspendida', () => {
    // Suspender una cuenta cierra su acceso. El cobro automático no tiene sesión que se lo impida,
    // así que lo tiene que respetar él: ni cobra ni reabre la cuenta.
    it('el cobro automático la omite: no cobra, no paga la cuota y no la reactiva', async () => {
      const passwordHash = await bcrypt.hash(PASSWORD, 10);
      const user = await userRepo.save(
        userRepo.create({
          email: `e2e-pay-suspendida-${unique()}@stopbet.cl`,
          passwordHash,
          role: 'patient',
          firstName: 'E2E',
          lastName: 'Suspendida',
          accountStatus: 'suspended',
          onboardingStatus: 'complete',
        }),
      );
      userIds.push(user.id);
      await inscriptionRepo.save(
        inscriptionRepo.create({ userId: user.id, username: user.id, token: `SUSP${unique().replace(/[^a-z0-9]/gi, '')}`, status: 'active', tbkUser: 'tbk-suspendida', cardType: 'Visa', cardLast4: '6623' }),
      );
      const debt = await invoiceRepo.save(
        invoiceRepo.create({ userId: user.id, month: '2020-05', amountCLP: 30000, status: 'overdue', dueDate: '2020-05-31' }),
      );
      gateway.authorize.mockClear();

      const res = await http().post('/payments/oneclick/charges/run-due').set(as(coordinator.token)).send({ asOf: '2020-12-31' }).expect(200);

      expect(res.body).toEqual(expect.arrayContaining([expect.objectContaining({ invoiceId: debt.id, result: 'skipped' })]));
      expect(gateway.authorize).not.toHaveBeenCalled();
      expect((await invoiceRepo.findOneByOrFail({ id: debt.id })).status).toBe('overdue');
      expect((await userRepo.findOneByOrFail({ id: user.id })).accountStatus).toBe('suspended');
      expect(await chargeRepo.count({ where: { userId: user.id } })).toBe(0);
    });
  });

  // ── Un cobro rechazado ────────────────────────────────────────────────────────────────────

  describe('cobro rechazado', () => {
    it('queda rechazado, la cuota sigue sin pagar y se puede volver a intentar', async () => {
      const pending = await invoiceRepo.save(
        invoiceRepo.create({ userId: patient.id, month: '2020-03', amountCLP: 30000, status: 'overdue', dueDate: '2020-03-31' }),
      );
      gateway.authorize.mockResolvedValueOnce({ ...approved, approved: false, status: 'FAILED', responseCode: -1, authorizationCode: null });

      const first = await http().post('/payments/oneclick/charges').set(as(patient.token)).send({ invoiceId: pending.id }).expect(201);
      expect(first.body).toMatchObject({ status: 'rejected', responseCode: -1 });
      expect((await invoiceRepo.findOneByOrFail({ id: pending.id })).status).toBe('overdue');

      // El índice único solo cuenta cobros en curso o autorizados: uno rechazado no bloquea el reintento.
      const retry = await http().post('/payments/oneclick/charges').set(as(patient.token)).send({ invoiceId: pending.id }).expect(201);
      expect(retry.body.status).toBe('authorized');
    });
  });

  // ── Herramientas de desarrollo ────────────────────────────────────────────────────────────

  describe('herramientas de desarrollo', () => {
    it('la página de prueba se sirve con ENABLE_DEV_TOOLS', async () => {
      const res = await http().get('/payments/oneclick/test-page').expect(200);

      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('Webpay Oneclick');
    });

    it('sin ENABLE_DEV_TOOLS, la página de prueba, el cobro automático y la consulta dan 404', async () => {
      process.env.ENABLE_DEV_TOOLS = 'false';
      try {
        await http().get('/payments/oneclick/test-page').expect(404);
        await http().post('/payments/oneclick/charges/run-due').set(as(coordinator.token)).send({}).expect(404);
        await http().get('/payments/oneclick/charges/00000000-0000-4000-8000-000000000000/transbank-status').set(as(coordinator.token)).expect(404);
      } finally {
        process.env.ENABLE_DEV_TOOLS = 'true';
      }
    });
  });

  // ── Eliminar la tarjeta ───────────────────────────────────────────────────────────────────

  describe('eliminar la tarjeta', () => {
    it('la borra en Transbank y deja al paciente sin tarjeta', async () => {
      await http().delete('/payments/oneclick/inscription').set(as(patient.token)).expect(204);

      expect(gateway.deleteInscription).toHaveBeenCalledWith(expect.any(String), patient.id);
      expect(await cardOf(patient)).toBeNull();
    });

    it('sin tarjeta, borrar responde 404 y cobrar responde 409', async () => {
      await http().delete('/payments/oneclick/inscription').set(as(patient.token)).expect(404);
      await http().post('/payments/oneclick/charges').set(as(patient.token)).send({}).expect(409);
    });
  });
});
