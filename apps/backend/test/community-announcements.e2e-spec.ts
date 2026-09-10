import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { User } from '../src/users/entities/user.entity';
import { RefreshToken } from '../src/auth/entities/refresh-token.entity';
import { CommunityPost } from '../src/community/entities/community-post.entity';

// POST /community/announcements no pedía ninguna identidad: el autor salía del
// header x-user-id, que nadie verifica. Cualquiera con la URL podía publicar un
// anuncio oficial de sede firmado como quien quisiera. Este archivo verifica el
// cierre contra una app real (BD real), igual que test/panic-assign.e2e-spec.ts.
describe('POST /community/announcements (e2e)', () => {
  let app: INestApplication;
  let userRepo: Repository<User>;
  let refreshTokenRepo: Repository<RefreshToken>;
  let communityPostRepo: Repository<CommunityPost>;

  const TEST_PASSWORD = 'TestE2E2026!';
  const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  let patientId: string;
  let sponsorId: string;
  let psychologistId: string;
  let coordinatorId: string;

  const createdPostIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // main.ts registra este pipe en producción; ningún *.e2e-spec.ts lo hace todavía,
    // así que sin esto los 400 por propiedades extra no ocurrirían.
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    userRepo = moduleFixture.get(getRepositoryToken(User));
    refreshTokenRepo = moduleFixture.get(getRepositoryToken(RefreshToken));
    communityPostRepo = moduleFixture.get(getRepositoryToken(CommunityPost));

    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

    const patient = await userRepo.save(
      userRepo.create({
        email: `e2e-community-patient-${unique()}@stopbet.cl`,
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
        email: `e2e-community-sponsor-${unique()}@stopbet.cl`,
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
        email: `e2e-community-psych-${unique()}@stopbet.cl`,
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
        email: `e2e-community-coord-${unique()}@stopbet.cl`,
        passwordHash,
        role: 'coordinator',
        firstName: 'E2E',
        lastName: 'Coordinator',
        accountStatus: 'active',
      }),
    );
    coordinatorId = coordinator.id;
  });

  afterAll(async () => {
    if (createdPostIds.length) {
      await communityPostRepo.delete(createdPostIds);
    }
    for (const id of [patientId, sponsorId, psychologistId, coordinatorId]) {
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
    return { body: 'Anuncio e2e', sede: 'Santiago', ...overrides };
  }

  describe('autenticación y rol', () => {
    it('sin Authorization → 401', async () => {
      await request(app.getHttpServer())
        .post('/community/announcements')
        .send(validBody())
        .expect(401);
    });

    it('con un token inválido → 401', async () => {
      await request(app.getHttpServer())
        .post('/community/announcements')
        .set('Authorization', 'Bearer token-basura')
        .send(validBody())
        .expect(401);
    });

    // El agujero original: el endpoint aceptaba el header falsificable x-user-id
    // (o nada) sin exigir jamás un token real. Esto reproduce exactamente eso.
    it('con x-user-id del psicólogo pero sin Authorization → 401 (regresión del agujero original)', async () => {
      await request(app.getHttpServer())
        .post('/community/announcements')
        .set('x-user-id', psychologistId)
        .send(validBody())
        .expect(401);
    });

    it('token de patient → 403', async () => {
      const token = await loginAs(
        (await userRepo.findOneOrFail({ where: { id: patientId } })).email,
      );
      await request(app.getHttpServer())
        .post('/community/announcements')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody())
        .expect(403);
    });

    it('token de sponsor → 403', async () => {
      const token = await loginAs(
        (await userRepo.findOneOrFail({ where: { id: sponsorId } })).email,
      );
      await request(app.getHttpServer())
        .post('/community/announcements')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody())
        .expect(403);
    });

    it('token de psychologist + body válido → 201', async () => {
      const token = await loginAs(
        (await userRepo.findOneOrFail({ where: { id: psychologistId } })).email,
      );
      const res = await request(app.getHttpServer())
        .post('/community/announcements')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody())
        .expect(201);
      createdPostIds.push(res.body.id);
    });

    it('token de coordinator + body válido → 201', async () => {
      const token = await loginAs(
        (await userRepo.findOneOrFail({ where: { id: coordinatorId } })).email,
      );
      const res = await request(app.getHttpServer())
        .post('/community/announcements')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody())
        .expect(201);
      createdPostIds.push(res.body.id);
    });
  });

  describe('validación del body', () => {
    let psychToken: string;

    beforeAll(async () => {
      psychToken = await loginAs(
        (await userRepo.findOneOrFail({ where: { id: psychologistId } })).email,
      );
    });

    it('body sin sede → 400', async () => {
      await request(app.getHttpServer())
        .post('/community/announcements')
        .set('Authorization', `Bearer ${psychToken}`)
        .send({ body: 'Anuncio sin sede' })
        .expect(400);
    });

    it('propiedad extra en el body → 400 (forbidNonWhitelisted)', async () => {
      await request(app.getHttpServer())
        .post('/community/announcements')
        .set('Authorization', `Bearer ${psychToken}`)
        .send(validBody({ foo: 'bar' }))
        .expect(400);
    });
  });

  describe('efecto real en la BD', () => {
    it('el authorId guardado es el del token, aunque se mande un x-user-id distinto', async () => {
      const token = await loginAs(
        (await userRepo.findOneOrFail({ where: { id: psychologistId } })).email,
      );

      const res = await request(app.getHttpServer())
        .post('/community/announcements')
        .set('Authorization', `Bearer ${token}`)
        .set('x-user-id', patientId)
        .send(validBody())
        .expect(201);
      createdPostIds.push(res.body.id);

      const saved = await communityPostRepo.findOneOrFail({ where: { id: res.body.id } });
      expect(saved.authorId).toBe(psychologistId);
      expect(saved.authorId).not.toBe(patientId);
    });
  });

  // El guard de POST /community/announcements se aplicó a nivel de método, no de
  // clase, a propósito: mobile sigue consumiendo estos otros endpoints solo con
  // x-user-id.
  describe('no-regresión: otros endpoints de community siguen sin exigir token', () => {
    it('GET /community/announcements?sede=Santiago con solo x-user-id → 200', async () => {
      await request(app.getHttpServer())
        .get('/community/announcements?sede=Santiago')
        .set('x-user-id', patientId)
        .expect(200);
    });

    it('POST /community/announcements/:id/attend con solo x-user-id → 200', async () => {
      const token = await loginAs(
        (await userRepo.findOneOrFail({ where: { id: psychologistId } })).email,
      );
      const created = await request(app.getHttpServer())
        .post('/community/announcements')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody())
        .expect(201);
      createdPostIds.push(created.body.id);

      await request(app.getHttpServer())
        .post(`/community/announcements/${created.body.id}/attend`)
        .set('x-user-id', patientId)
        .expect(200);
    });
  });
});
