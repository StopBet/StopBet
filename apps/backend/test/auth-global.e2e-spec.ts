import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { User } from '../src/users/entities/user.entity';
import { RefreshToken } from '../src/auth/entities/refresh-token.entity';
import { PatientAssignment } from '../src/psychologists/entities/patient-assignment.entity';

// JwtAuthGuard global: todo endpoint exige token salvo los @Public(), y la identidad sale del
// token, no del header x-user-id que el cliente podía inventar.
describe('Guard JWT global (e2e)', () => {
  let app: INestApplication;
  let userRepo: Repository<User>;
  let refreshTokenRepo: Repository<RefreshToken>;
  let assignmentRepo: Repository<PatientAssignment>;

  const PASSWORD = 'TestE2E2026!';
  const ids: string[] = [];
  let patient: User;
  let otherPatient: User;
  let psychologist: User;
  let coordinator: User;

  async function crear(role: User['role'], nombre: string): Promise<User> {
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const u = await userRepo.save(userRepo.create({
      email: `e2e-guard-${nombre}-${Date.now()}@stopbet.cl`,
      passwordHash, role, firstName: 'E2E', lastName: nombre, accountStatus: 'active',
    }));
    ids.push(u.id);
    return u;
  }

  async function token(u: User): Promise<string> {
    const res = await request(app.getHttpServer()).post('/auth/login').send({ email: u.email, password: PASSWORD }).expect(200);
    return res.body.accessToken;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    userRepo = moduleFixture.get(getRepositoryToken(User));
    refreshTokenRepo = moduleFixture.get(getRepositoryToken(RefreshToken));
    assignmentRepo = moduleFixture.get(getRepositoryToken(PatientAssignment));

    patient = await crear('patient', 'Paciente');
    otherPatient = await crear('patient', 'OtroPaciente');
    psychologist = await crear('psychologist', 'Psicologo');
    coordinator = await crear('coordinator', 'Coordinacion');
    await assignmentRepo.save(assignmentRepo.create({
      patientId: patient.id, psychologistId: psychologist.id, sedeId: 'e2e-sede', active: true,
    }));
  });

  afterAll(async () => {
    await assignmentRepo.delete({ patientId: patient.id });
    for (const id of ids) {
      await refreshTokenRepo.delete({ userId: id });
      await userRepo.delete({ id });
    }
    await app.close();
  });

  describe('lo público sigue abierto', () => {
    it('GET /health → 200 sin token', () => request(app.getHttpServer()).get('/health').expect(200));
    it('GET /sedes → 200 sin token', () => request(app.getHttpServer()).get('/sedes').expect(200));
  });

  describe('lo que antes estaba abierto ahora pide token', () => {
    it.each([
      ['GET', '/check-ins/today'],
      ['GET', '/notifications'],
      ['GET', '/ai/sessions/active'],
      ['GET', '/community/posts/00000000-0000-0000-0000-000000000000/replies'],
      ['POST', '/panic/assign'],
      ['POST', '/subscriptions'],
    ])('%s %s sin token → 401', async (verbo, ruta) => {
      const r = request(app.getHttpServer());
      await (verbo === 'GET' ? r.get(ruta) : r.post(ruta).send({})).expect(401);
    });

    // El ataque que cerraba: sin credencial, mandar el UUID de un paciente en el header.
    it('x-user-id de un paciente sin token → 401', async () => {
      await request(app.getHttpServer())
        .get('/check-ins/today')
        .set('x-user-id', patient.id)
        .expect(401);
    });
  });

  describe('la identidad sale del token, no del header', () => {
    it('con el token de un paciente, un x-user-id ajeno se ignora', async () => {
      const t = await token(otherPatient);
      const res = await request(app.getHttpServer())
        .get('/subscriptions/me')
        .set('Authorization', `Bearer ${t}`)
        .set('x-user-id', patient.id)
        .expect(200);
      // Las suscripciones que devuelve, si hay, son del dueño del token.
      for (const sub of res.body as Array<{ userId: string }>) expect(sub.userId).toBe(otherPatient.id);
    });
  });

  describe('huecos cerrados', () => {
    it('POST /panic/assign con rol patient → 403', async () => {
      const t = await token(patient);
      await request(app.getHttpServer())
        .post('/panic/assign')
        .set('Authorization', `Bearer ${t}`)
        .send({ patientId: patient.id, sponsorId: otherPatient.id })
        .expect(403);
    });
  });

  describe('endpoints del equipo clínico sobre un paciente', () => {
    const ruta = () => `/billing/patients/${patient.id}/status`;

    it('psicólogo con el paciente asignado → 200', async () => {
      await request(app.getHttpServer()).get(ruta()).set('Authorization', `Bearer ${await token(psychologist)}`).expect(200);
    });

    it('coordinación → 200 aunque no tenga asignaciones', async () => {
      await request(app.getHttpServer()).get(ruta()).set('Authorization', `Bearer ${await token(coordinator)}`).expect(200);
    });

    it('psicólogo pidiendo un paciente que no es suyo → 403', async () => {
      await request(app.getHttpServer())
        .get(`/billing/patients/${otherPatient.id}/status`)
        .set('Authorization', `Bearer ${await token(psychologist)}`)
        .expect(403);
    });

    it('un paciente no puede usar el endpoint del equipo clínico → 403', async () => {
      await request(app.getHttpServer()).get(ruta()).set('Authorization', `Bearer ${await token(patient)}`).expect(403);
    });
  });
});
