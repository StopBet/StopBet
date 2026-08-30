import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { User } from '../src/users/entities/user.entity';
import { RefreshToken } from '../src/auth/entities/refresh-token.entity';

// S.5 — 403 verificable en endpoints protegidos por rol, contra una app real (BD real).
describe('Roles guard (e2e)', () => {
  let app: INestApplication;
  let userRepo: Repository<User>;
  let refreshTokenRepo: Repository<RefreshToken>;

  const TEST_PASSWORD = 'TestE2E2026!';
  let patientId: string;
  let psychologistId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userRepo = moduleFixture.get(getRepositoryToken(User));
    refreshTokenRepo = moduleFixture.get(getRepositoryToken(RefreshToken));

    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

    const patient = await userRepo.save(
      userRepo.create({
        email: `e2e-patient-${Date.now()}@stopbet.cl`,
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
        email: `e2e-psych-${Date.now()}@stopbet.cl`,
        passwordHash,
        role: 'psychologist',
        firstName: 'E2E',
        lastName: 'Psychologist',
        accountStatus: 'active',
      }),
    );
    psychologistId = psychologist.id;
  });

  afterAll(async () => {
    await refreshTokenRepo.delete({ userId: patientId });
    await refreshTokenRepo.delete({ userId: psychologistId });
    await userRepo.delete({ id: patientId });
    await userRepo.delete({ id: psychologistId });
    await app.close();
  });

  async function loginAs(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: TEST_PASSWORD })
      .expect(200);
    return res.body.accessToken;
  }

  describe('GET /users/patients', () => {
    it('sin token → 401', async () => {
      await request(app.getHttpServer()).get('/users/patients').expect(401);
    });

    it('con rol patient → 403', async () => {
      const token = await loginAs(
        (await userRepo.findOneOrFail({ where: { id: patientId } })).email,
      );
      await request(app.getHttpServer())
        .get('/users/patients')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('con rol psychologist → 200', async () => {
      const token = await loginAs(
        (await userRepo.findOneOrFail({ where: { id: psychologistId } })).email,
      );
      await request(app.getHttpServer())
        .get('/users/patients')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });

  describe('GET /users/:id/progress', () => {
    it('sin token → 401', async () => {
      await request(app.getHttpServer()).get(`/users/${patientId}/progress`).expect(401);
    });

    it('con rol patient → 403', async () => {
      const token = await loginAs(
        (await userRepo.findOneOrFail({ where: { id: patientId } })).email,
      );
      await request(app.getHttpServer())
        .get(`/users/${patientId}/progress`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('con rol psychologist → 200', async () => {
      const token = await loginAs(
        (await userRepo.findOneOrFail({ where: { id: psychologistId } })).email,
      );
      await request(app.getHttpServer())
        .get(`/users/${patientId}/progress`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });

  describe('GET /metrics/patients/:id', () => {
    it('sin token → 401', async () => {
      await request(app.getHttpServer()).get(`/metrics/patients/${patientId}`).expect(401);
    });

    it('con rol patient → 403', async () => {
      const token = await loginAs(
        (await userRepo.findOneOrFail({ where: { id: patientId } })).email,
      );
      await request(app.getHttpServer())
        .get(`/metrics/patients/${patientId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('con rol psychologist → 200', async () => {
      const token = await loginAs(
        (await userRepo.findOneOrFail({ where: { id: psychologistId } })).email,
      );
      await request(app.getHttpServer())
        .get(`/metrics/patients/${patientId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });

  describe('GET /registration/pending', () => {
    it('sin token → 401', async () => {
      await request(app.getHttpServer()).get('/registration/pending').expect(401);
    });

    it('con rol patient → 403', async () => {
      const token = await loginAs(
        (await userRepo.findOneOrFail({ where: { id: patientId } })).email,
      );
      await request(app.getHttpServer())
        .get('/registration/pending')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('con rol psychologist → 200', async () => {
      const token = await loginAs(
        (await userRepo.findOneOrFail({ where: { id: psychologistId } })).email,
      );
      await request(app.getHttpServer())
        .get('/registration/pending')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });

  describe('GET /panic/alerts/history', () => {
    it('sin token → 401', async () => {
      await request(app.getHttpServer()).get('/panic/alerts/history').expect(401);
    });

    it('con rol patient → 403', async () => {
      const token = await loginAs(
        (await userRepo.findOneOrFail({ where: { id: patientId } })).email,
      );
      await request(app.getHttpServer())
        .get('/panic/alerts/history')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('con rol psychologist → 200', async () => {
      const token = await loginAs(
        (await userRepo.findOneOrFail({ where: { id: psychologistId } })).email,
      );
      await request(app.getHttpServer())
        .get('/panic/alerts/history')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });

  describe('endpoints públicos de /auth (@Public, sin guard global todavía)', () => {
    it('POST /auth/login sigue accesible sin token', async () => {
      const patient = await userRepo.findOneOrFail({ where: { id: patientId } });
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: patient.email, password: TEST_PASSWORD })
        .expect(200);
    });

    it('POST /auth/login con clave incorrecta → 401, no 403', async () => {
      const patient = await userRepo.findOneOrFail({ where: { id: patientId } });
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: patient.email, password: 'clave-incorrecta' })
        .expect(401);
    });
  });
});
