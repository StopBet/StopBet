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
import { PatientAssignment } from '../src/psychologists/entities/patient-assignment.entity';
import { RegistrationRequest } from '../src/registration/entities/registration-request.entity';

// 24.4 — la gestión de cuentas de psicólogo exige @Roles('coordinator'), verificable con
// una app real (BD real), no solo con la UI.
describe('Psychologists guard (e2e)', () => {
  let app: INestApplication;
  let userRepo: Repository<User>;
  let refreshTokenRepo: Repository<RefreshToken>;
  let sedeRepo: Repository<Sede>;
  let psychSedeRepo: Repository<PsychologistSede>;
  let assignmentRepo: Repository<PatientAssignment>;
  let requestRepo: Repository<RegistrationRequest>;

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
    assignmentRepo = moduleFixture.get(getRepositoryToken(PatientAssignment));
    requestRepo = moduleFixture.get(getRepositoryToken(RegistrationRequest));

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

  async function loginAs(email: string, password = TEST_PASSWORD): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
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

  // El recorrido que faltaba: los unitarios mockeaban assignmentRepo.find con pacientes que
  // la aplicación nunca creaba, así que CA24.3 pasaba en verde estando muerta. Esto va contra
  // Postgres real, de la aprobación a la baja.
  describe('Asignación de pacientes (CA24.3)', () => {
    let originPsychId: string;
    let targetPsychId: string;
    let targetPsychToken: string;
    let newPatientId: string;
    let coordinatorToken: string;

    async function createPsychologist(): Promise<{ id: string; token: string }> {
      const res = await request(app.getHttpServer())
        .post('/psychologists')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          firstName: 'E2E',
          lastName: 'Asignación',
          email: `e2e-assign-${Date.now()}-${Math.random().toString(36).slice(2)}@stopbet.cl`,
          rut: '11.111.111-1',
          sedeIds: [sedeId],
        })
        .expect(201);
      createdPsychologistIds.push(res.body.id);
      const token = await loginAs(res.body.email, res.body.temporaryPassword);
      return { id: res.body.id, token };
    }

    beforeAll(async () => {
      coordinatorToken = await loginAs(
        (await userRepo.findOneOrFail({ where: { id: coordinatorId } })).email,
      );
      originPsychId = (await createPsychologist()).id;
      const target = await createPsychologist();
      targetPsychId = target.id;
      targetPsychToken = target.token;

      const submitted = await request(app.getHttpServer())
        .post('/registration/submit')
        .send({
          firstName: 'Paciente',
          lastName: 'E2E',
          rut: '12.345.678-5',
          email: `e2e-assign-patient-${Date.now()}-${Math.random().toString(36).slice(2)}@stopbet.cl`,
          sedeId,
          institutionId: 'AJUTER',
        })
        .expect(201);
      newPatientId = submitted.body.userId;

      await request(app.getHttpServer())
        .patch(`/registration/${submitted.body.requestId}/approve`)
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({ assignedPsychologistId: originPsychId })
        .expect(200);
    });

    afterAll(async () => {
      await assignmentRepo.delete({ patientId: newPatientId });
      await refreshTokenRepo.delete({ userId: newPatientId });
      await requestRepo.delete({ userId: newPatientId });
      await userRepo.delete({ id: newPatientId });
    });

    it('aprobar la solicitud crea la asignación del paciente', async () => {
      const assignments = await assignmentRepo.find({ where: { patientId: newPatientId } });

      expect(assignments).toHaveLength(1);
      expect(assignments[0].psychologistId).toBe(originPsychId);
      expect(assignments[0].active).toBe(true);
      expect(assignments[0].endedAt).toBeNull();
    });

    // El dashboard web aprueba SIN cuerpo: el campo assignedPsychologistId es nuevo y su
    // cliente todavía no lo manda. Si el ValidationPipe rechazara ese caso, aprobar desde la
    // web se rompería sin que ningún otro test lo notara.
    it('aprobar sin cuerpo asigna a quien revisa, como hace la web hoy', async () => {
      const submitted = await request(app.getHttpServer())
        .post('/registration/submit')
        .send({
          firstName: 'Paciente',
          lastName: 'SinCuerpo',
          rut: '12.345.678-5',
          email: `e2e-nobody-${Date.now()}-${Math.random().toString(36).slice(2)}@stopbet.cl`,
          sedeId,
          institutionId: 'AJUTER',
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/registration/${submitted.body.requestId}/approve`)
        .set('Authorization', `Bearer ${targetPsychToken}`)
        .expect(200);

      const assignments = await assignmentRepo.find({
        where: { patientId: submitted.body.userId },
      });
      expect(assignments).toHaveLength(1);
      expect(assignments[0].psychologistId).toBe(targetPsychId);

      await assignmentRepo.delete({ patientId: submitted.body.userId });
      await requestRepo.delete({ userId: submitted.body.userId });
      await userRepo.delete({ id: submitted.body.userId });
    });

    // Un coordinador no atiende pacientes: si aprueba sin decir a quién asignar, el error
    // tiene que explicar qué falta, no decir que el psicólogo "no existe".
    it('un coordinador que aprueba sin indicar psicólogo recibe un error accionable', async () => {
      const submitted = await request(app.getHttpServer())
        .post('/registration/submit')
        .send({
          firstName: 'Paciente',
          lastName: 'SinAsignar',
          rut: '12.345.678-5',
          email: `e2e-noassign-${Date.now()}-${Math.random().toString(36).slice(2)}@stopbet.cl`,
          sedeId,
          institutionId: 'AJUTER',
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .patch(`/registration/${submitted.body.requestId}/approve`)
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .expect(400);

      expect(res.body.message).toContain('Indica a qué psicólogo');

      await requestRepo.delete({ userId: submitted.body.userId });
      await userRepo.delete({ id: submitted.body.userId });
    });

    it('desactivar sin reasignar → 409 con la lista de pacientes', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/psychologists/${originPsychId}/deactivate`)
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({})
        .expect(409);

      expect(res.body.patientIds).toContain(newPatientId);
    });

    it('el psicólogo sigue activo tras el 409', async () => {
      const psych = await userRepo.findOneOrFail({ where: { id: originPsychId } });
      expect(psych.accountStatus).toBe('active');
    });

    it('desactivar reasignando cierra la asignación vieja y abre una nueva', async () => {
      await request(app.getHttpServer())
        .patch(`/psychologists/${originPsychId}/deactivate`)
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({ reassignTo: targetPsychId })
        .expect(200);

      const assignments = await assignmentRepo.find({
        where: { patientId: newPatientId },
        order: { assignedAt: 'ASC' },
      });

      expect(assignments).toHaveLength(2);

      const closed = assignments.find((a) => !a.active);
      const current = assignments.find((a) => a.active);

      expect(closed?.psychologistId).toBe(originPsychId);
      expect(closed?.endedAt).not.toBeNull();
      expect(current?.psychologistId).toBe(targetPsychId);

      const psych = await userRepo.findOneOrFail({ where: { id: originPsychId } });
      expect(psych.accountStatus).toBe('suspended');
    });
  });
});
