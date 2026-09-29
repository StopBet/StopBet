import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { User } from '../src/users/entities/user.entity';
import { RefreshToken } from '../src/auth/entities/refresh-token.entity';
import { SponsorDesignation } from '../src/panic/entities/sponsor-designation.entity';
import { SponsorAssignment } from '../src/panic/entities/sponsor-assignment.entity';

// HdU20/HdU21 contra una base de datos real.
//
// Existe por dos fallos que los unitarios no pueden ver, porque mockean los repositorios:
//
//   1. `SponsorDesignation` quedó fuera del array `entities` de `app.module.ts`. El
//      repositorio se inyectaba igual (está en el `forFeature` del módulo), así que los 374
//      unitarios pasaban — pero la tabla nunca se creaba y todo `/sponsors` respondía 500,
//      en local y en Railway.
//   2. Los DTO validaban con `@IsUUID()`, que aplica el criterio de la RFC y rechaza los ids
//      escritos a mano del seed: 24 de las 25 cuentas de desarrollo daban 400.
//
// Por eso las cuentas de acá se crean con ids con forma de seed y no con `uuid_generate_v4()`.
describe('Compañeros de viaje (e2e)', () => {
  let app: INestApplication;
  let userRepo: Repository<User>;
  let refreshTokenRepo: Repository<RefreshToken>;
  let designationRepo: Repository<SponsorDesignation>;
  let assignmentRepo: Repository<SponsorAssignment>;

  const TEST_PASSWORD = 'TestE2E2026!';
  const SEDE = 'e2e-sede-sponsors';
  const marca = Date.now().toString(16).padStart(12, '0').slice(-12);

  // Ids con la forma del seed: hexadecimales 8-4-4-4-12 pero sin los bits de versión ni
  // variante que exige la RFC. Postgres los acepta; `@IsUUID()` no.
  const idSeed = (n: string) =>
    `${n.repeat(8)}-${n.repeat(4)}-${n.repeat(4)}-${n.repeat(4)}-${marca}`;

  const PSI = idSeed('a');
  const PACIENTE = idSeed('b');
  const FUTURO_COMPANERO = idSeed('c');

  let token: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userRepo = moduleFixture.get(getRepositoryToken(User));
    refreshTokenRepo = moduleFixture.get(getRepositoryToken(RefreshToken));
    designationRepo = moduleFixture.get(getRepositoryToken(SponsorDesignation));
    assignmentRepo = moduleFixture.get(getRepositoryToken(SponsorAssignment));

    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const email = `e2e-sponsors-psi-${marca}@stopbet.cl`;

    await userRepo.save([
      userRepo.create({
        id: PSI, email, passwordHash, role: 'psychologist',
        firstName: 'E2E', lastName: 'Psicologo',
        accountStatus: 'active', sedeId: SEDE,
      }),
      userRepo.create({
        id: PACIENTE, email: `e2e-sponsors-pac-${marca}@stopbet.cl`, passwordHash,
        role: 'patient', firstName: 'E2E', lastName: 'Paciente',
        accountStatus: 'active', sedeId: SEDE,
      }),
      userRepo.create({
        id: FUTURO_COMPANERO, email: `e2e-sponsors-comp-${marca}@stopbet.cl`, passwordHash,
        role: 'patient', firstName: 'E2E', lastName: 'Companero',
        accountStatus: 'active', sedeId: SEDE,
      }),
    ]);

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: TEST_PASSWORD })
      .expect(200);
    token = res.body.accessToken;
  });

  afterAll(async () => {
    await assignmentRepo.delete({ patientId: PACIENTE });
    await designationRepo.delete({ patientId: FUTURO_COMPANERO });
    for (const id of [PSI, PACIENTE, FUTURO_COMPANERO]) {
      await refreshTokenRepo.delete({ userId: id });
      await userRepo.delete({ id });
    }
    await app.close();
  });

  const conToken = (peticion: request.Test) =>
    peticion.set('Authorization', `Bearer ${token}`);

  it('CA21.2: lista candidatos de la sede — la tabla existe y los ids del seed pasan', async () => {
    const res = await conToken(
      request(app.getHttpServer()).get('/sponsors/candidates'),
    ).expect(200);

    const ids = res.body.map((c: { id: string }) => c.id);
    expect(ids).toContain(FUTURO_COMPANERO);
    expect(ids).toContain(PACIENTE);
  });

  it('CA21.1: designa y registra al psicólogo y la fecha', async () => {
    const res = await conToken(
      request(app.getHttpServer())
        .post('/sponsors/designate')
        .send({ patientId: FUTURO_COMPANERO }),
    ).expect(201);

    expect(res.body.designatedBy).toBe(PSI);
    expect(res.body.isActive).toBe(true);
    expect(res.body.designatedAt).toBeTruthy();
  });

  it('CA21.2: el designado sale de la lista de candidatos', async () => {
    const res = await conToken(
      request(app.getHttpServer()).get('/sponsors/candidates'),
    ).expect(200);

    const ids = res.body.map((c: { id: string }) => c.id);
    expect(ids).not.toContain(FUTURO_COMPANERO);
  });

  it('CA21.1: no se designa dos veces al mismo', async () => {
    await conToken(
      request(app.getHttpServer())
        .post('/sponsors/designate')
        .send({ patientId: FUTURO_COMPANERO }),
    ).expect(409);
  });

  it('CA20.4: el paciente todavía no tiene a nadie', async () => {
    const res = await conToken(
      request(app.getHttpServer()).get(`/sponsors/current?patientId=${PACIENTE}`),
    ).expect(200);

    expect(res.body).toEqual({});
  });

  it('CA20.2: el designado aparece como asignable, y el paciente no se lista a sí mismo', async () => {
    const res = await conToken(
      request(app.getHttpServer()).get(`/sponsors/available?patientId=${PACIENTE}`),
    ).expect(200);

    const ids = res.body.map((c: { id: string }) => c.id);
    expect(ids).toContain(FUTURO_COMPANERO);
    expect(ids).not.toContain(PACIENTE);
  });

  it('CA20.1: asigna y el perfil lo refleja', async () => {
    await conToken(
      request(app.getHttpServer())
        .post('/sponsors/assign')
        .send({ patientId: PACIENTE, sponsorId: FUTURO_COMPANERO }),
    ).expect(204);

    const res = await conToken(
      request(app.getHttpServer()).get(`/sponsors/current?patientId=${PACIENTE}`),
    ).expect(200);

    expect(res.body.id).toBe(FUTURO_COMPANERO);
  });

  it('CA21.3: no deja revocar mientras tenga a alguien a cargo', async () => {
    const res = await conToken(
      request(app.getHttpServer()).post(`/sponsors/${FUTURO_COMPANERO}/revoke`),
    ).expect(409);

    expect(res.body.message).toContain('1 paciente');
  });

  it('rechaza asignar a alguien que no fue designado', async () => {
    await conToken(
      request(app.getHttpServer())
        .post('/sponsors/assign')
        .send({ patientId: PACIENTE, sponsorId: PSI }),
    ).expect(400);
  });

  it('un identificador con basura da 400, no un error de Postgres', async () => {
    await conToken(
      request(app.getHttpServer()).get('/sponsors/available?patientId=no-es-un-id'),
    ).expect(400);
  });
});
