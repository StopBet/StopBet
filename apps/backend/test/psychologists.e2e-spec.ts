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

// 24.4 — la gestión de cuentas de psicólogo exige @Roles('coordinator'), verificable con
// una app real (BD real), no solo con la UI.
describe('Psychologists guard (e2e)', () => {
  let app: INestApplication;
  let userRepo: Repository<User>;
  let refreshTokenRepo: Repository<RefreshToken>;
  let sedeRepo: Repository<Sede>;
  let psychSedeRepo: Repository<PsychologistSede>;

  const TEST_PASSWORD = 'TestE2E2026!';
  let patientId: string;
  let psychologistId: string;
  let coordinatorId: string;
  let sedeId: string;
  const createdPsychologistIds: string[] = [];

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

    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    // Sufijo random además del timestamp: roles.e2e-spec.ts genera emails con el mismo
    // prefijo e2e-patient-/e2e-psych-${Date.now()}, y Jest corre los dos archivos en
    // procesos paralelos — sin esto, dos beforeAll cayendo en el mismo milisegundo
    // chocan contra el UNIQUE de users.email.
    const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const patient = await userRepo.save(
      userRepo.create({
        email: `e2e-patient-${unique()}@stopbet.cl`,
        passwordHash,
        role: 'patient',
        firstName: 'E2E',
        lastName: 'Patient',
        accountStatus: 'active',
      }),
    );
    patientId = patient.id;

    const psychologist = await userRepo.save(
      userRepo.create({
        email: `e2e-psych-${unique()}@stopbet.cl`,
        passwordHash,
        role: 'psychologist',
        firstName: 'E2E',
        lastName: 'Psychologist',
        accountStatus: 'active',
      }),
    );
    psychologistId = psychologist.id;

    const coordinator = await userRepo.save(
      userRepo.create({
        email: `e2e-coordinator-${unique()}@stopbet.cl`,
        passwordHash,
        role: 'coordinator',
        firstName: 'E2E',
        lastName: 'Coordinator',
        accountStatus: 'active',
      }),
    );
    coordinatorId = coordinator.id;

    const sedes = await sedeRepo.find({ where: { isActive: true } });
    sedeId = sedes[0].id;
  });

  afterAll(async () => {
    for (const id of [...createdPsychologistIds, psychologistId, coordinatorId]) {
      await psychSedeRepo.delete({ psychologistId: id });
      await refreshTokenRepo.delete({ userId: id });
      await userRepo.delete({ id });
    }
    await refreshTokenRepo.delete({ userId: patientId });
    await userRepo.delete({ id: patientId });
    await app.close();
  });

  async function loginAs(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: TEST_PASSWORD })
      .expect(200);
    return res.body.accessToken;
  }

  describe('POST /psychologists', () => {
    const newPsychBody = () => ({
      firstName: 'Nueva',
      lastName: 'Psicóloga',
      email: `e2e-new-psych-${Date.now()}-${Math.random().toString(36).slice(2)}@stopbet.cl`,
      rut: '11.111.111-1',
      sedeIds: [sedeId],
    });

    it('sin token → 401', async () => {
      await request(app.getHttpServer()).post('/psychologists').send(newPsychBody()).expect(401);
    });

    it('con rol psychologist → 403', async () => {
      const token = await loginAs(
        (await userRepo.findOneOrFail({ where: { id: psychologistId } })).email,
      );
      await request(app.getHttpServer())
        .post('/psychologists')
        .set('Authorization', `Bearer ${token}`)
        .send(newPsychBody())
        .expect(403);
    });

    it('con rol coordinator → 201 y devuelve una contraseña temporal', async () => {
      const token = await loginAs(
        (await userRepo.findOneOrFail({ where: { id: coordinatorId } })).email,
      );
      const res = await request(app.getHttpServer())
        .post('/psychologists')
        .set('Authorization', `Bearer ${token}`)
        .send(newPsychBody())
        .expect(201);

      expect(typeof res.body.temporaryPassword).toBe('string');
      expect(res.body.temporaryPassword.length).toBeGreaterThanOrEqual(12);
      createdPsychologistIds.push(res.body.id);
    });
  });

  describe('GET /psychologists', () => {
    it('sin token → 401', async () => {
      await request(app.getHttpServer()).get('/psychologists').expect(401);
    });

    it('con rol patient → 403', async () => {
      const token = await loginAs(
        (await userRepo.findOneOrFail({ where: { id: patientId } })).email,
      );
      await request(app.getHttpServer())
        .get('/psychologists')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('con rol psychologist → 200', async () => {
      const token = await loginAs(
        (await userRepo.findOneOrFail({ where: { id: psychologistId } })).email,
      );
      await request(app.getHttpServer())
        .get('/psychologists')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('con rol coordinator → 200', async () => {
      const token = await loginAs(
        (await userRepo.findOneOrFail({ where: { id: coordinatorId } })).email,
      );
      await request(app.getHttpServer())
        .get('/psychologists')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });
});
