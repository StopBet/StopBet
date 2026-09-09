import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { User } from '../src/users/entities/user.entity';
import { RefreshToken } from '../src/auth/entities/refresh-token.entity';
import { SponsorAssignment } from '../src/panic/entities/sponsor-assignment.entity';

// POST /panic/assign no pedía ninguna identidad: ni token, ni siquiera el header
// x-user-id. Cualquiera con la URL podía reasignar el padrino de cualquier paciente.
// Este archivo verifica el cierre contra una app real (BD real), igual que S.5 lo
// hace en test/roles.e2e-spec.ts — que es de José y no se toca.
describe('POST /panic/assign (e2e)', () => {
  let app: INestApplication;
  let userRepo: Repository<User>;
  let refreshTokenRepo: Repository<RefreshToken>;
  let sponsorAssignmentRepo: Repository<SponsorAssignment>;

  const TEST_PASSWORD = 'TestE2E2026!';
  const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  let patientId: string;
  let sponsorId: string;
  let psychologistId: string;
  let coordinatorId: string;
  let suspendedSponsorId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // main.ts registra este pipe en producción; ningún *.e2e-spec.ts lo hace todavía,
    // así que sin esto los 400 por UUID inválido o por propiedades extra no ocurrirían.
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    userRepo = moduleFixture.get(getRepositoryToken(User));
    refreshTokenRepo = moduleFixture.get(getRepositoryToken(RefreshToken));
    sponsorAssignmentRepo = moduleFixture.get(getRepositoryToken(SponsorAssignment));

    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

    const patient = await userRepo.save(
      userRepo.create({
        email: `e2e-panic-patient-${unique()}@stopbet.cl`,
        passwordHash,
        role: 'patient',
        firstName: 'E2E',
        lastName: 'Patient',
        accountStatus: 'active',
      }),
    );
    patientId = patient.id;

    const sponsor = await userRepo.save(
      userRepo.create({
        email: `e2e-panic-sponsor-${unique()}@stopbet.cl`,
        passwordHash,
        role: 'sponsor',
        firstName: 'E2E',
        lastName: 'Sponsor',
        accountStatus: 'active',
      }),
    );
    sponsorId = sponsor.id;

    const psychologist = await userRepo.save(
      userRepo.create({
        email: `e2e-panic-psych-${unique()}@stopbet.cl`,
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
        email: `e2e-panic-coord-${unique()}@stopbet.cl`,
        passwordHash,
        role: 'coordinator',
        firstName: 'E2E',
        lastName: 'Coordinator',
        accountStatus: 'active',
      }),
    );
    coordinatorId = coordinator.id;

    const suspendedSponsor = await userRepo.save(
      userRepo.create({
        email: `e2e-panic-susp-sponsor-${unique()}@stopbet.cl`,
        passwordHash,
        role: 'sponsor',
        firstName: 'E2E',
        lastName: 'SuspendedSponsor',
        accountStatus: 'suspended',
      }),
    );
    suspendedSponsorId = suspendedSponsor.id;
  });

  afterAll(async () => {
    await sponsorAssignmentRepo.delete({ patientId });
    for (const id of [patientId, sponsorId, psychologistId, coordinatorId, suspendedSponsorId]) {
      await refreshTokenRepo.delete({ userId: id });
      await userRepo.delete({ id });
    }
    await app.close();
  });

  async function loginAs(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: TEST_PASSWORD })
      .expect(200);
    return res.body.accessToken;
  }

  function validBody(overrides: Record<string, unknown> = {}) {
    return { patientId, sponsorId, ...overrides };
  }

  describe('autenticación y rol', () => {
    it('sin Authorization → 401', async () => {
      await request(app.getHttpServer())
        .post('/panic/assign')
        .send(validBody())
        .expect(401);
    });

    it('con un token inválido → 401', async () => {
      await request(app.getHttpServer())
        .post('/panic/assign')
        .set('Authorization', 'Bearer token-basura')
        .send(validBody())
        .expect(401);
    });

    // El agujero original: el endpoint aceptaba el header falsificable x-user-id
    // (o nada) sin exigir jamás un token real. Esto reproduce exactamente eso.
    it('con x-user-id del psicólogo pero sin Authorization → 401 (regresión del agujero original)', async () => {
      await request(app.getHttpServer())
        .post('/panic/assign')
        .set('x-user-id', psychologistId)
        .send(validBody())
        .expect(401);
    });

    it('token de patient → 403', async () => {
      const token = await loginAs(
        (await userRepo.findOneOrFail({ where: { id: patientId } })).email,
      );
      await request(app.getHttpServer())
        .post('/panic/assign')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody())
        .expect(403);
    });

    it('token de sponsor → 403', async () => {
      const token = await loginAs(
        (await userRepo.findOneOrFail({ where: { id: sponsorId } })).email,
      );
      await request(app.getHttpServer())
        .post('/panic/assign')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody())
        .expect(403);
    });

    it('token de psychologist + body válido → 204', async () => {
      const token = await loginAs(
        (await userRepo.findOneOrFail({ where: { id: psychologistId } })).email,
      );
      await request(app.getHttpServer())
        .post('/panic/assign')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody())
        .expect(204);
    });

    it('token de coordinator + body válido → 204', async () => {
      const token = await loginAs(
        (await userRepo.findOneOrFail({ where: { id: coordinatorId } })).email,
      );
      await request(app.getHttpServer())
        .post('/panic/assign')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody())
        .expect(204);
    });
  });

  describe('validación del body', () => {
    let psychToken: string;

    beforeAll(async () => {
      psychToken = await loginAs(
        (await userRepo.findOneOrFail({ where: { id: psychologistId } })).email,
      );
    });

    it('patientId que no es UUID → 400', async () => {
      await request(app.getHttpServer())
        .post('/panic/assign')
        .set('Authorization', `Bearer ${psychToken}`)
        .send(validBody({ patientId: 'no-es-uuid' }))
        .expect(400);
    });

    it('propiedad extra en el body → 400 (forbidNonWhitelisted)', async () => {
      await request(app.getHttpServer())
        .post('/panic/assign')
        .set('Authorization', `Bearer ${psychToken}`)
        .send(validBody({ foo: 'bar' }))
        .expect(400);
    });

    it('patientId inexistente → 400', async () => {
      await request(app.getHttpServer())
        .post('/panic/assign')
        .set('Authorization', `Bearer ${psychToken}`)
        .send(validBody({ patientId: '00000000-0000-0000-0000-000000000000' }))
        .expect(400);
    });

    it('sponsorId con rol equivocado (el del psicólogo) → 400', async () => {
      await request(app.getHttpServer())
        .post('/panic/assign')
        .set('Authorization', `Bearer ${psychToken}`)
        .send(validBody({ sponsorId: psychologistId }))
        .expect(400);
    });

    it('sponsorId suspendido → 400', async () => {
      await request(app.getHttpServer())
        .post('/panic/assign')
        .set('Authorization', `Bearer ${psychToken}`)
        .send(validBody({ sponsorId: suspendedSponsorId }))
        .expect(400);
    });
  });

  describe('efecto real en la BD', () => {
    it('el 204 deja la asignación activa correcta en sponsor_assignments', async () => {
      const token = await loginAs(
        (await userRepo.findOneOrFail({ where: { id: psychologistId } })).email,
      );

      await request(app.getHttpServer())
        .post('/panic/assign')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody())
        .expect(204);

      const active = await sponsorAssignmentRepo.findOne({
        where: { patientId, isActive: true },
      });
      expect(active).not.toBeNull();
      expect(active!.sponsorId).toBe(sponsorId);
    });

    it('un sponsorId inexistente no deja al paciente sin padrino (no huérfano)', async () => {
      const token = await loginAs(
        (await userRepo.findOneOrFail({ where: { id: psychologistId } })).email,
      );

      // Asignación válida vigente, como base
      await request(app.getHttpServer())
        .post('/panic/assign')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody())
        .expect(204);

      // Intento inválido: no debe tocar la asignación anterior
      await request(app.getHttpServer())
        .post('/panic/assign')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody({ sponsorId: '00000000-0000-0000-0000-000000000000' }))
        .expect(400);

      const stillActive = await sponsorAssignmentRepo.findOne({
        where: { patientId, isActive: true },
      });
      expect(stillActive).not.toBeNull();
      expect(stillActive!.sponsorId).toBe(sponsorId);
    });
  });

  // El guard de /panic/assign se aplicó a nivel de método, no de clase, a propósito:
  // mobile sigue consumiendo estos otros endpoints solo con x-user-id.
  describe('no-regresión: otros endpoints de panic siguen sin exigir token', () => {
    it('POST /panic/alerts con solo x-user-id → 201', async () => {
      await request(app.getHttpServer())
        .post('/panic/alerts')
        .set('x-user-id', patientId)
        .expect(201);
    });

    it('GET /panic/sponsor con solo x-user-id → 200', async () => {
      await request(app.getHttpServer())
        .get('/panic/sponsor')
        .set('x-user-id', patientId)
        .expect(200);
    });
  });
});
