import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, In, Raw, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { RefreshToken } from '../src/auth/entities/refresh-token.entity';
import { FamilyLink } from '../src/family/entities/family-link.entity';
import { FamilyLinkReview } from '../src/family/entities/family-link-review.entity';
import { Notification } from '../src/notifications/entities/notification.entity';
import { PsychologistSede } from '../src/psychologists/entities/psychologist-sede.entity';
import { Sede } from '../src/sedes/entities/sede.entity';
import { User } from '../src/users/entities/user.entity';

// HDU 22 y 23 de punta a punta, por la API real con sus guards y el ValidationPipe de main.ts.
// Los unitarios de FamilyService cubren las ramas; esto cubre que las piezas encajen: el
// registro público, la sede de quien revisa, la respuesta del paciente desde la app y que el
// acceso del familiar se abra y se cierre de verdad.
//
// Los tests van en orden: cada uno parte del estado que dejó el anterior, como la guía de prueba.
describe('Familiares: registro y vinculación (e2e)', () => {
  let app: INestApplication;
  let userRepo: Repository<User>;
  let refreshTokenRepo: Repository<RefreshToken>;
  let sedeRepo: Repository<Sede>;
  let psychSedeRepo: Repository<PsychologistSede>;
  let linkRepo: Repository<FamilyLink>;
  let reviewRepo: Repository<FamilyLinkReview>;
  let notifRepo: Repository<Notification>;

  const PASSWORD = 'TestE2E2026!';
  const userIds: string[] = [];
  const unique = () => `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;

  // RUT válido al azar: el registro rechaza un RUT ya usado, y la base local puede traer los del seed.
  function randomRut(): string {
    const body = String(30_000_000 + Math.floor(Math.random() * 9_000_000));
    let sum = 0;
    let factor = 2;
    for (const d of [...body].reverse()) {
      sum += Number(d) * factor;
      factor = factor === 7 ? 2 : factor + 1;
    }
    const r = 11 - (sum % 11);
    const dv = r === 11 ? '0' : r === 10 ? 'K' : String(r);
    return `${body.slice(0, 2)}.${body.slice(2, 5)}.${body.slice(5)}-${dv}`;
  }

  let patient: { id: string; email: string; token: string };
  let psychLocal: { id: string; token: string };
  let psychRemote: { id: string; token: string };
  let coordinator: { id: string; token: string };

  const famA = { email: `e2e-fam-a-${unique()}@stopbet.cl`, rut: randomRut() };
  const famC = { email: `e2e-fam-c-${unique()}@stopbet.cl`, rut: randomRut() };
  let famAId: string;
  let famCId: string;
  let famAToken: string;
  let famCToken: string;
  let linkAId: string;

  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function login(email: string): Promise<string> {
    const res = await http().post('/auth/login').send({ email, password: PASSWORD }).expect(200);
    return res.body.accessToken;
  }

  async function makeUser(role: User['role'], label: string, sedeId: string | null = null) {
    const user = await userRepo.save(
      userRepo.create({
        email: `e2e-fam-${label}-${unique()}@stopbet.cl`,
        passwordHash: await bcrypt.hash(PASSWORD, 10),
        role,
        firstName: 'E2E',
        lastName: label,
        accountStatus: 'active',
        sedeId,
      }),
    );
    userIds.push(user.id);
    return { id: user.id, email: user.email, token: await login(user.email) };
  }

  const register = (fields: Record<string, unknown>) =>
    http()
      .post('/family/register')
      .send({ firstName: 'Familiar', lastName: 'E2E', password: PASSWORD, ...fields });

  const titlesOf = async (userId: string) => (await notifRepo.find({ where: { userId } })).map((n) => n.title);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    userRepo = moduleFixture.get(getRepositoryToken(User));
    refreshTokenRepo = moduleFixture.get(getRepositoryToken(RefreshToken));
    sedeRepo = moduleFixture.get(getRepositoryToken(Sede));
    psychSedeRepo = moduleFixture.get(getRepositoryToken(PsychologistSede));
    const dataSource = moduleFixture.get(DataSource);
    linkRepo = dataSource.getRepository(FamilyLink);
    reviewRepo = dataSource.getRepository(FamilyLinkReview);
    notifRepo = dataSource.getRepository(Notification);

    const sedes = await sedeRepo.find({ where: { isActive: true } });
    const [localSedeId, remoteSedeId] = [sedes[0].id, sedes[1].id];

    patient = await makeUser('patient', 'paciente', localSedeId);
    psychLocal = await makeUser('psychologist', 'psico-local');
    psychRemote = await makeUser('psychologist', 'psico-otra-sede');
    coordinator = await makeUser('coordinator', 'coordinacion');
    await psychSedeRepo.save([
      psychSedeRepo.create({ psychologistId: psychLocal.id, sedeId: localSedeId }),
      psychSedeRepo.create({ psychologistId: psychRemote.id, sedeId: remoteSedeId }),
    ]);
  });

  afterAll(async () => {
    const familyIds = [famAId, famCId].filter(Boolean);
    userIds.push(...familyIds);
    const links = await linkRepo.find({ where: [{ familyUserId: In(userIds) }, { patientUserId: In(userIds) }] });
    if (links.length) await reviewRepo.delete({ linkId: In(links.map((l) => l.id)) });
    for (const id of userIds) {
      await notifRepo.delete({ userId: id });
      await psychSedeRepo.delete({ psychologistId: id });
      await refreshTokenRepo.delete({ userId: id });
      await userRepo.delete({ id }); // family_links cae en cascada
    }
    await app.close();
  });

  // ── HDU 22 ──────────────────────────────────────────────────────────────────────────────

  it('22·CA4: campos vacíos o inválidos dan 400 y no crean nada', async () => {
    await register({ email: 'sin-arroba', rut: '11.111.111-2', patientEmail: patient.email }).expect(400);
    await http().post('/family/register').send({ firstName: 'Solo nombre' }).expect(400);
  });

  it('22·CA1: el familiar se registra declarando al paciente y avisa a los psicólogos de su sede', async () => {
    const res = await register({ email: famA.email, rut: famA.rut, patientEmail: patient.email }).expect(201);

    expect(res.body).toEqual({ userId: expect.any(String), status: 'pending' });
    famAId = res.body.userId;
    expect(await titlesOf(psychLocal.id)).toContain('Nuevo familiar por vincular');
    expect(await titlesOf(psychRemote.id)).not.toContain('Nuevo familiar por vincular');
  });

  it('22·CA3: el mismo correo con otras mayúsculas no crea una segunda cuenta', async () => {
    const res = await register({ email: famA.email.toUpperCase(), rut: randomRut(), patientEmail: patient.email }).expect(409);

    expect(res.body.message).toBe('Ya existe una cuenta con esos datos');
    const sameMailbox = await userRepo.count({
      where: { email: Raw((a) => `LOWER(${a}) = LOWER(:e)`, { e: famA.email }) },
    });
    expect(sameMailbox).toBe(1);
  });

  it('22·CA3: el mismo RUT con otro correo tampoco', async () => {
    await register({ email: `e2e-fam-otro-${unique()}@stopbet.cl`, rut: famA.rut, patientEmail: patient.email }).expect(409);
  });

  it('22·CA2: un paciente que no existe recibe la misma respuesta y solo alerta a coordinación', async () => {
    const res = await register({ email: famC.email, rut: famC.rut, patientRut: randomRut() }).expect(201);

    expect(res.body).toEqual({ userId: expect.any(String), status: 'pending' });
    famCId = res.body.userId;
    expect(await titlesOf(coordinator.id)).toContain('Familiar con un paciente que no está en el sistema');

    const pending = await http().get('/family/pending').set(as(psychLocal.token)).expect(200);
    expect(pending.body.map((l: { familyUserId: string }) => l.familyUserId)).not.toContain(famCId);
  });

  it('22·CA2: la cuenta igual se crea y puede entrar, pendiente de vinculación', async () => {
    famCToken = await login(famC.email);

    const status = await http().get('/family/link-status').set(as(famCToken)).expect(200);
    expect(status.body).toEqual({ status: 'pending' });
  });

  it('22·CA5: pendiente, no ve sesiones, cuotas ni el nombre del paciente', async () => {
    famAToken = await login(famA.email);

    const sessions = await http().get('/family/sessions').set(as(famAToken)).expect(200);
    expect(sessions.body).toMatchObject({ linkStatus: 'pending', sessions: [] });

    const billing = await http().get('/family/billing').set(as(famAToken)).expect(200);
    expect(billing.body.linkStatus).toBe('pending');
    expect(JSON.stringify(billing.body)).not.toContain('E2E');
  });

  it('22·CA6: reenviar la misma declaración no la duplica y avisa que está en revisión', async () => {
    const res = await http().post('/family/link').set(as(famAToken)).send({ patientEmail: patient.email }).expect(201);

    expect(res.body).toEqual({ status: 'pending', alreadyInReview: true });
    expect(await linkRepo.count({ where: { familyUserId: famAId } })).toBe(1);
  });

  // ── HDU 23 ──────────────────────────────────────────────────────────────────────────────

  it('23·CA1: el psicólogo de la sede ve al familiar, al paciente y la fecha; el de otra sede no', async () => {
    const local = await http().get('/family/pending').set(as(psychLocal.token)).expect(200);
    const item = local.body.find((l: { familyUserId: string }) => l.familyUserId === famAId);
    expect(item).toMatchObject({ familyEmail: famA.email, patientUserId: patient.id, createdAt: expect.any(String) });
    linkAId = item.id;

    const remote = await http().get('/family/pending').set(as(psychRemote.token)).expect(200);
    expect(remote.body.map((l: { id: string }) => l.id)).not.toContain(linkAId);
  });

  it('23·CA1: un psicólogo de otra sede tampoco puede decidir sobre el vínculo', async () => {
    await http().patch(`/family/links/${linkAId}/confirm`).set(as(psychRemote.token)).send({ verification: 'in_person' }).expect(403);
  });

  it('23·CA4: sin respuesta del paciente, «paciente consultado» no vale', async () => {
    await http().patch(`/family/links/${linkAId}/confirm`).set(as(psychLocal.token)).send({ verification: 'patient_consulted' }).expect(409);
  });

  it('23·CA4: si el paciente dice que no desde la app, solo se puede rechazar', async () => {
    const requests = await http().get('/family/patient-requests').set(as(patient.token)).expect(200);
    expect(requests.body.map((r: { id: string }) => r.id)).toContain(linkAId);

    await http().patch(`/family/patient-requests/${linkAId}`).set(as(patient.token)).send({ accept: false }).expect(200);
    await http().patch(`/family/links/${linkAId}/confirm`).set(as(psychLocal.token)).send({ verification: 'in_person' }).expect(409);
  });

  it('23·CA2: con el «sí» del paciente se confirma, se avisa a ambos y el familiar ve sus datos', async () => {
    await http().patch(`/family/patient-requests/${linkAId}`).set(as(patient.token)).send({ accept: true }).expect(200);
    await http().patch(`/family/links/${linkAId}/confirm`).set(as(psychLocal.token)).send({ verification: 'patient_consulted' }).expect(200);

    expect(await titlesOf(famAId)).toContain('¡Tu vínculo fue confirmado!');
    expect(await titlesOf(patient.id)).toContain('Un familiar fue vinculado a tu cuenta');
    const billing = await http().get('/family/billing').set(as(famAToken)).expect(200);
    expect(billing.body).toMatchObject({ linkStatus: 'active', patientFirstName: 'E2E' });
  });

  it('23·CA3: rechazar deja la cuenta sin vincular y avisa solo al familiar', async () => {
    await http().post('/family/link').set(as(famCToken)).send({ patientEmail: patient.email }).expect(201);
    const pending = await http().get('/family/pending').set(as(psychLocal.token)).expect(200);
    const linkC = pending.body.find((l: { familyUserId: string }) => l.familyUserId === famCId);
    const patientTitlesBefore = await titlesOf(patient.id);

    await http().patch(`/family/links/${linkC.id}/reject`).set(as(psychLocal.token)).expect(200);

    expect(await titlesOf(famCId)).toContain('Tu solicitud de vinculación no fue aprobada');
    expect((await titlesOf(patient.id)).length).toBe(patientTitlesBefore.length);
    const sessions = await http().get('/family/sessions').set(as(famCToken)).expect(200);
    expect(sessions.body.linkStatus).not.toBe('active');
  });

  it('23·CA5: revocar corta el acceso de inmediato y avisa a ambos', async () => {
    await http().patch(`/family/links/${linkAId}/revoke`).set(as(psychLocal.token)).expect(200);

    const billing = await http().get('/family/billing').set(as(famAToken)).expect(200);
    expect(billing.body.linkStatus).toBe('revoked');
    expect(billing.body.patientFirstName).toBeNull();
    expect(await titlesOf(famAId)).toContain('Tu acceso como familiar fue revocado');
    expect(await titlesOf(patient.id)).toContain('Se retiró el acceso de un familiar');
  });

  it('23·CA6: cada decisión queda registrada con autor, fecha y veredicto', async () => {
    const reviews = await reviewRepo.find({ where: { linkId: linkAId }, order: { reviewedAt: 'ASC' } });

    expect(reviews.map((r) => [r.verdict, r.reviewedBy, r.verification])).toEqual([
      ['confirmed', psychLocal.id, 'patient_consulted'],
      ['revoked', psychLocal.id, null],
    ]);
    reviews.forEach((r) => expect(r.reviewedAt).toBeInstanceOf(Date));
  });
});
