import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { User } from '../src/users/entities/user.entity';
import { RefreshToken } from '../src/auth/entities/refresh-token.entity';
import { Sede } from '../src/sedes/entities/sede.entity';
import { PsychologistSede } from '../src/psychologists/entities/psychologist-sede.entity';
import { PatientAssignment } from '../src/psychologists/entities/patient-assignment.entity';
import { RegistrationRequest } from '../src/registration/entities/registration-request.entity';
import { RegistrationReview } from '../src/registration/entities/registration-review.entity';

// El endpoint que decide quién entra a la clínica no tenía guard: leía `x-user-id` de una
// cabecera sin verificar nada. Y no filtraba por sede, así que un psicólogo de una sede
// aprobaba solicitudes de cualquier otra.
//
// HdU19 v2: ahora decide solo el coordinador. Los psicólogos reciben 403 en todo el módulo,
// aunque la solicitud sea de su sede; el filtro por sede del servicio queda cubierto por los
// unitarios.
describe('Registration approve/reject/reopen (e2e)', () => {
  let app: INestApplication;
  let userRepo: Repository<User>;
  let refreshTokenRepo: Repository<RefreshToken>;
  let sedeRepo: Repository<Sede>;
  let psychSedeRepo: Repository<PsychologistSede>;
  let assignmentRepo: Repository<PatientAssignment>;
  let requestRepo: Repository<RegistrationRequest>;
  let reviewRepo: Repository<RegistrationReview>;

  const TEST_PASSWORD = 'TestE2E2026!';
  const userIds: string[] = [];
  const requestIds: string[] = [];

  let patientId: string;
  let patientEmail: string;
  let psychLocalEmail: string;
  let psychRemoteEmail: string;
  let coordinatorEmail: string;
  let psychLocalId: string;
  let psychRemoteId: string;
  let localSedeId: string;
  let remoteSedeId: string;

  const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  async function makeUser(role: User['role'], prefix: string, passwordHash: string) {
    const user = await userRepo.save(
      userRepo.create({
        email: `e2e-reg-${prefix}-${unique()}@stopbet.cl`,
        passwordHash,
        role,
        firstName: 'E2E',
        lastName: prefix,
        accountStatus: 'active',
      }),
    );
    userIds.push(user.id);
    return user;
  }

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
    assignmentRepo = moduleFixture.get(getRepositoryToken(PatientAssignment));
    requestRepo = moduleFixture.get(getRepositoryToken(RegistrationRequest));
    // Sin forFeature en el módulo (el servicio usa el manager de la transacción): se pide al DataSource.
    reviewRepo = moduleFixture.get(DataSource).getRepository(RegistrationReview);

    const sedes = await sedeRepo.find({ where: { isActive: true } });
    localSedeId = sedes[0].id;
    remoteSedeId = sedes[1].id;

    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

    const patient = await makeUser('patient', 'patient', passwordHash);
    patientId = patient.id;
    patientEmail = patient.email;

    const psychLocal = await makeUser('psychologist', 'psych-local', passwordHash);
    psychLocalId = psychLocal.id;
    psychLocalEmail = psychLocal.email;

    const psychRemote = await makeUser('psychologist', 'psych-remote', passwordHash);
    psychRemoteEmail = psychRemote.email;
    psychRemoteId = psychRemote.id;

    coordinatorEmail = (await makeUser('coordinator', 'coordinator', passwordHash)).email;

    // Vínculos M2M explícitos: cada psicólogo atiende una sede distinta.
    await psychSedeRepo.save([
      psychSedeRepo.create({ psychologistId: psychLocal.id, sedeId: localSedeId }),
      psychSedeRepo.create({ psychologistId: psychRemote.id, sedeId: remoteSedeId }),
    ]);
  });

  afterAll(async () => {
    await assignmentRepo.delete({ patientId });
    if (requestIds.length) {
      await reviewRepo.delete({ requestId: In(requestIds) });
      await requestRepo.delete({ id: In(requestIds) });
    }
    for (const id of userIds) {
      await psychSedeRepo.delete({ psychologistId: id });
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

  async function makePendingRequest(sedeId: string): Promise<string> {
    const req = await requestRepo.save(
      requestRepo.create({ userId: patientId, sedeId, status: 'pending' }),
    );
    requestIds.push(req.id);
    return req.id;
  }

  async function makeRejectedRequest(sedeId: string): Promise<string> {
    const req = await requestRepo.save(
      requestRepo.create({ userId: patientId, sedeId, status: 'rejected', reviewedAt: new Date() }),
    );
    requestIds.push(req.id);
    return req.id;
  }

  describe('PATCH /registration/:id/approve — permisos', () => {
    it('sin token → 401', async () => {
      const requestId = await makePendingRequest(localSedeId);
      await request(app.getHttpServer())
        .patch(`/registration/${requestId}/approve`)
        .expect(401);
    });

    // La cabecera que el endpoint leía antes ya no sirve para nada: sin token es 401 aunque
    // se mande el UUID de un psicólogo real.
    it('con x-user-id pero sin token → 401', async () => {
      const requestId = await makePendingRequest(localSedeId);
      await request(app.getHttpServer())
        .patch(`/registration/${requestId}/approve`)
        .set('x-user-id', psychLocalId)
        .expect(401);
    });

    it('con rol patient → 403', async () => {
      const requestId = await makePendingRequest(localSedeId);
      const token = await loginAs(patientEmail);
      await request(app.getHttpServer())
        .patch(`/registration/${requestId}/approve`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('un psicólogo de otra sede → 403 y la solicitud sigue pendiente', async () => {
      const requestId = await makePendingRequest(localSedeId);
      const token = await loginAs(psychRemoteEmail);
      await request(app.getHttpServer())
        .patch(`/registration/${requestId}/approve`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      const req = await requestRepo.findOneOrFail({ where: { id: requestId } });
      expect(req.status).toBe('pending');
    });

    // HdU19 v2: aunque la solicitud sea de su propia sede, aprobar ya no es del psicólogo.
    it('el psicólogo de la sede aprueba → 403 y la solicitud sigue pendiente', async () => {
      const requestId = await makePendingRequest(localSedeId);
      const token = await loginAs(psychLocalEmail);
      await request(app.getHttpServer())
        .patch(`/registration/${requestId}/approve`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      const req = await requestRepo.findOneOrFail({ where: { id: requestId } });
      expect(req.status).toBe('pending');
      expect(await assignmentRepo.count({ where: { patientId, active: true } })).toBe(0);
    });

    it('el coordinador aprueba una sede que no es la suya, indicando psicólogo', async () => {
      const requestId = await makePendingRequest(localSedeId);
      const token = await loginAs(coordinatorEmail);
      await request(app.getHttpServer())
        .patch(`/registration/${requestId}/approve`)
        .set('Authorization', `Bearer ${token}`)
        .send({ assignedPsychologistId: psychLocalId })
        .expect(200);

      const review = await reviewRepo.findOneOrFail({ where: { requestId } });
      expect(review.verdict).toBe('approved');
      expect(review.reviewerRole).toBe('coordinator');

      await assignmentRepo.delete({ patientId, psychologistId: psychLocalId });
    });

    // CA2 modelo individual: el filtro de la web no basta, un cliente a mano podía asignar al
    // paciente a un psicólogo que no atiende su sede.
    it('el coordinador asigna a un psicólogo de otra sede → 400 y no cambia nada', async () => {
      const requestId = await makePendingRequest(localSedeId);
      const token = await loginAs(coordinatorEmail);
      const res = await request(app.getHttpServer())
        .patch(`/registration/${requestId}/approve`)
        .set('Authorization', `Bearer ${token}`)
        .send({ assignedPsychologistId: psychRemoteId })
        .expect(400);

      expect(res.body.message).toContain('no atiende la sede del paciente');
      const req = await requestRepo.findOneOrFail({ where: { id: requestId } });
      expect(req.status).toBe('pending');
      expect(await assignmentRepo.count({ where: { patientId, active: true } })).toBe(0);
      expect(await reviewRepo.count({ where: { requestId } })).toBe(0);
    });
  });

  describe('PATCH /registration/:id/reject — permisos', () => {
    it('sin token → 401', async () => {
      const requestId = await makePendingRequest(localSedeId);
      await request(app.getHttpServer())
        .patch(`/registration/${requestId}/reject`)
        .expect(401);
    });

    it('un psicólogo de otra sede → 403', async () => {
      const requestId = await makePendingRequest(localSedeId);
      const token = await loginAs(psychRemoteEmail);
      await request(app.getHttpServer())
        .patch(`/registration/${requestId}/reject`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('un psicólogo de la misma sede → 403 y la solicitud sigue pendiente', async () => {
      const requestId = await makePendingRequest(localSedeId);
      const token = await loginAs(psychLocalEmail);
      await request(app.getHttpServer())
        .patch(`/registration/${requestId}/reject`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      const req = await requestRepo.findOneOrFail({ where: { id: requestId } });
      expect(req.status).toBe('pending');
    });

    it('el coordinador rechaza → 200 y queda la fila de auditoría', async () => {
      const requestId = await makePendingRequest(localSedeId);
      const token = await loginAs(coordinatorEmail);
      await request(app.getHttpServer())
        .patch(`/registration/${requestId}/reject`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const req = await requestRepo.findOneOrFail({ where: { id: requestId } });
      expect(req.status).toBe('rejected');

      const review = await reviewRepo.findOneOrFail({ where: { requestId } });
      expect(review.verdict).toBe('rejected');
      expect(review.reviewerRole).toBe('coordinator');
    });
  });

  describe('PATCH /registration/:id/reopen', () => {
    it('sin token → 401', async () => {
      const requestId = await makeRejectedRequest(localSedeId);
      await request(app.getHttpServer())
        .patch(`/registration/${requestId}/reopen`)
        .expect(401);
    });

    it('un psicólogo → 403 y la solicitud sigue rechazada', async () => {
      const requestId = await makeRejectedRequest(localSedeId);
      const token = await loginAs(psychLocalEmail);
      await request(app.getHttpServer())
        .patch(`/registration/${requestId}/reopen`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      const req = await requestRepo.findOneOrFail({ where: { id: requestId } });
      expect(req.status).toBe('rejected');
    });

    it('el coordinador reabre una rechazada → 200, vuelve a pendiente y queda la auditoría', async () => {
      const requestId = await makeRejectedRequest(localSedeId);
      const token = await loginAs(coordinatorEmail);
      await request(app.getHttpServer())
        .patch(`/registration/${requestId}/reopen`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const req = await requestRepo.findOneOrFail({ where: { id: requestId } });
      expect(req.status).toBe('pending');
      expect(req.reviewedBy).toBeNull();
      expect(req.reviewedAt).toBeNull();

      const review = await reviewRepo.findOneOrFail({ where: { requestId } });
      expect(review.verdict).toBe('reopened');
      expect(review.reviewerRole).toBe('coordinator');
    });

    it('reabrir una pendiente → 409', async () => {
      const requestId = await makePendingRequest(localSedeId);
      const token = await loginAs(coordinatorEmail);
      await request(app.getHttpServer())
        .patch(`/registration/${requestId}/reopen`)
        .set('Authorization', `Bearer ${token}`)
        .expect(409);
    });
  });

  describe('GET /registration/pending — solo coordinación', () => {
    it('el psicólogo de la sede → 403', async () => {
      const token = await loginAs(psychLocalEmail);
      await request(app.getHttpServer())
        .get('/registration/pending')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('el coordinador ve las de todas las sedes', async () => {
      const local = await makePendingRequest(localSedeId);
      const remote = await makePendingRequest(remoteSedeId);

      const token = await loginAs(coordinatorEmail);
      const res = await request(app.getHttpServer())
        .get('/registration/pending')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const ids = res.body.map((r: { id: string }) => r.id);
      expect(ids).toContain(local);
      expect(ids).toContain(remote);
    });
  });

  describe('GET /registration/rejected', () => {
    // `:requestId` es @Public(): si `rejected` se declarara después, Nest lo capturaría como
    // un id, el guard no correría y sin token daría 404 en vez de 401.
    it('sin token → 401, no lo captura la ruta pública :requestId', async () => {
      await request(app.getHttpServer()).get('/registration/rejected').expect(401);
    });

    it('un psicólogo → 403', async () => {
      const token = await loginAs(psychLocalEmail);
      await request(app.getHttpServer())
        .get('/registration/rejected')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('el coordinador → 200 e incluye la rechazada', async () => {
      const rejected = await makeRejectedRequest(localSedeId);

      const token = await loginAs(coordinatorEmail);
      const res = await request(app.getHttpServer())
        .get('/registration/rejected')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const ids = res.body.map((r: { id: string }) => r.id);
      expect(ids).toContain(rejected);
    });
  });

  describe('GET /registration/history', () => {
    it('sin token → 401, no lo captura la ruta pública :requestId', async () => {
      await request(app.getHttpServer()).get('/registration/history').expect(401);
    });

    it('un psicólogo → 403', async () => {
      const token = await loginAs(psychLocalEmail);
      await request(app.getHttpServer())
        .get('/registration/history')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('el coordinador ve la decisión que acaba de tomar, con paciente, autor y rol', async () => {
      const requestId = await makePendingRequest(localSedeId);
      const token = await loginAs(coordinatorEmail);
      await request(app.getHttpServer())
        .patch(`/registration/${requestId}/reject`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .get('/registration/history')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const review = await reviewRepo.findOneOrFail({ where: { requestId } });
      const entry = res.body.find((e: { id: string }) => e.id === review.id);
      expect(entry).toEqual(
        expect.objectContaining({
          verdict: 'rejected',
          reviewerRole: 'coordinator',
          patientName: expect.any(String),
          reviewerName: expect.any(String),
        }),
      );
      expect(new Date(entry.reviewedAt).getTime()).not.toBeNaN();
    });
  });
});
