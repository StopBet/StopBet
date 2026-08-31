import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { User } from '../src/users/entities/user.entity';
import { RefreshToken } from '../src/auth/entities/refresh-token.entity';
import { Sede } from '../src/sedes/entities/sede.entity';
import { PsychologistSede } from '../src/psychologists/entities/psychologist-sede.entity';

// La BD e2e llega vacía en CI (no corre el seed): este spec crea todos sus propios
// fixtures — sede, coordinador y psicólogo — en vez de depender de datos ya sembrados.
describe('Cuentas suspendidas — cierre de acceso (e2e)', () => {
  let app: INestApplication;
  let userRepo: Repository<User>;
  let refreshTokenRepo: Repository<RefreshToken>;
  let sedeRepo: Repository<Sede>;
  let psychSedeRepo: Repository<PsychologistSede>;

  const TEST_PASSWORD = 'TestE2E2026!';
  let coordinatorId: string;
  let coordinatorToken: string;
  let sedeId: string;
  const createdPsychologistIds: string[] = [];

  // Jest corre los specs en procesos paralelos: el sufijo random evita chocar contra el
  // UNIQUE de users.email si dos beforeAll caen en el mismo milisegundo.
  const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // RUTs válidos (módulo 11) ya verificados, para no perder tiempo si @IsRut() rechaza uno.
  const VALID_RUTS = ['12.345.678-5', '17.654.321-3', '9.876.543-3', '21.456.789-K'];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userRepo = moduleFixture.get(getRepositoryToken(User));
    refreshTokenRepo = moduleFixture.get(getRepositoryToken(RefreshToken));
    sedeRepo = moduleFixture.get(getRepositoryToken(Sede));
    psychSedeRepo = moduleFixture.get(getRepositoryToken(PsychologistSede));

    const sede = await sedeRepo.save(
      sedeRepo.create({
        name: `E2E Suspendida ${unique()}`,
        address: 'Dirección de prueba',
        type: 'presential',
        isActive: true,
      }),
    );
    sedeId = sede.id;

    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const coordinator = await userRepo.save(
      userRepo.create({
        email: `e2e-suspend-coord-${unique()}@stopbet.cl`,
        passwordHash,
        role: 'coordinator',
        firstName: 'E2E',
        lastName: 'Coordinator',
        accountStatus: 'active',
      }),
    );
    coordinatorId = coordinator.id;

    coordinatorToken = await loginAs(coordinator.email);
  });

  afterAll(async () => {
    for (const id of [...createdPsychologistIds, coordinatorId]) {
      await psychSedeRepo.delete({ psychologistId: id });
      await refreshTokenRepo.delete({ userId: id });
      await userRepo.delete({ id });
    }
    await sedeRepo.delete({ id: sedeId });
    await app.close();
  });

  async function loginAs(email: string, password = TEST_PASSWORD): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    return res.body.accessToken;
  }

  async function loginFull(
    email: string,
    password = TEST_PASSWORD,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    return { accessToken: res.body.accessToken, refreshToken: res.body.refreshToken };
  }

  async function createPsychologist(rut: string): Promise<{ id: string; email: string; temporaryPassword: string }> {
    const res = await request(app.getHttpServer())
      .post('/psychologists')
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({
        firstName: 'E2E',
        lastName: 'Suspendido',
        email: `e2e-suspend-psych-${unique()}@stopbet.cl`,
        rut,
        sedeIds: [sedeId],
      })
      .expect(201);
    createdPsychologistIds.push(res.body.id);
    return { id: res.body.id, email: res.body.email, temporaryPassword: res.body.temporaryPassword };
  }

  async function suspend(id: string): Promise<void> {
    await request(app.getHttpServer())
      .patch(`/psychologists/${id}/deactivate`)
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({})
      .expect(200);
  }

  // Puerta A — login. Antes del fix esto respondía 200 con tokens nuevos.
  it('puerta A: login vuelve a intentarse tras suspender → 403', async () => {
    const psych = await createPsychologist(VALID_RUTS[0]);

    await loginAs(psych.email, psych.temporaryPassword); // control: entra antes de suspender
    await suspend(psych.id);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: psych.email, password: psych.temporaryPassword })
      .expect(403);
  });

  // Puerta C — el guard de cada request. Este es el corazón del bug: antes del fix, un
  // access token emitido ANTES de suspender seguía sirviendo para leer datos después.
  it('puerta C: un access token emitido antes de suspender deja de servir → 401', async () => {
    const psych = await createPsychologist(VALID_RUTS[1]);
    const { accessToken } = await loginFull(psych.email, psych.temporaryPassword);

    await suspend(psych.id);

    await request(app.getHttpServer())
      .get('/psychologists')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);
  });

  // Puerta B — refresh. Sin el fix, quien ya tenía un refresh token seguiría renovando
  // acceso hasta 7 días después de la baja. Responde 401, no 403: la puerta D (revocación
  // de refresh tokens) corre en la misma transacción de deactivate(), así que para cuando
  // llega este request el token ya está revocado y auth.service.ts:57 lo rechaza por ahí
  // ANTES de llegar al chequeo de accountStatus que daría 403. El acceso queda cerrado
  // igual; el 403 de refresh() queda como respaldo para el caso en que, por algún motivo,
  // el token no se hubiera revocado.
  it('puerta B: el refresh token emitido antes de suspender deja de renovar → 401', async () => {
    const psych = await createPsychologist(VALID_RUTS[2]);
    const { refreshToken } = await loginFull(psych.email, psych.temporaryPassword);

    await suspend(psych.id);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });

  // Puerta D — la revocación que hace deactivate() sobre los refresh tokens ya emitidos.
  it('puerta D: suspender deja todos los refresh tokens del usuario revocados en la BD', async () => {
    const psych = await createPsychologist(VALID_RUTS[3]);
    await loginFull(psych.email, psych.temporaryPassword);
    await loginFull(psych.email, psych.temporaryPassword); // dos sesiones abiertas a la vez

    await suspend(psych.id);

    const tokens = await refreshTokenRepo.find({ where: { userId: psych.id } });
    expect(tokens.length).toBeGreaterThanOrEqual(2);
    expect(tokens.every((t) => t.revokedAt !== null)).toBe(true);
  });

  // Regresión: una cuenta activa no debe verse afectada por ninguno de los chequeos nuevos.
  it('regresión: una cuenta activa sigue funcionando en login, refresh y requests autenticados', async () => {
    const { accessToken, refreshToken } = await loginFull(
      (await userRepo.findOneOrFail({ where: { id: coordinatorId } })).email,
    );

    await request(app.getHttpServer())
      .get('/psychologists')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(200);
  });
});
