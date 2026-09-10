import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { User } from '../src/users/entities/user.entity';

// POST /achievements/dev-set-days es una puerta trasera de desarrollo viva en
// producción: sobreescribía los días de abstinencia de cualquier usuario sin pedir
// identidad. Se cierra detrás de DEV_TOOLS_ENABLED, que Railway no define.
describe('POST /achievements/dev-set-days (e2e)', () => {
  let app: INestApplication;
  let userRepo: Repository<User>;

  const TEST_PASSWORD = 'TestE2E2026!';
  const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  let patientId: string;

  // El e2e levanta AppModule, que carga el .env real de quien corre los tests. Si
  // ese .env local tiene DEV_TOOLS_ENABLED=true (para probar el botón de mobile en
  // local, ver docs/avisos-al-equipo.md), el caso del 403 no puede pasar de verdad.
  // Se fuerza a ausente antes de compilar el módulo, y si igual queda en 'true'
  // después de app.init() (porque el ConfigService ya leyó el archivo .env), se
  // salta ese caso con un mensaje claro en vez de dejarlo fallar en falso.
  // En CI no hay .env, así que allá el 403 se verifica de verdad.
  const originalDevToolsEnabled = process.env.DEV_TOOLS_ENABLED;
  let devToolsEnabledFromEnvFile = false;

  beforeAll(async () => {
    delete process.env.DEV_TOOLS_ENABLED;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    const config = app.get(ConfigService);
    devToolsEnabledFromEnvFile = config.get<string>('DEV_TOOLS_ENABLED') === 'true';

    userRepo = moduleFixture.get(getRepositoryToken(User));

    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const patient = await userRepo.save(
      userRepo.create({
        email: `e2e-achievements-dev-patient-${unique()}@stopbet.cl`,
        passwordHash,
        role: 'patient',
        firstName: 'E2E',
        lastName: 'Patient',
        accountStatus: 'active',
      }),
    );
    patientId = patient.id;
  });

  afterAll(async () => {
    await userRepo.delete({ id: patientId });
    await app.close();
    if (originalDevToolsEnabled === undefined) {
      delete process.env.DEV_TOOLS_ENABLED;
    } else {
      process.env.DEV_TOOLS_ENABLED = originalDevToolsEnabled;
    }
  });

  it('con DEV_TOOLS_ENABLED ausente → 403', async () => {
    if (devToolsEnabledFromEnvFile) {
      console.warn(
        'SALTADO: el .env local de este backend tiene DEV_TOOLS_ENABLED=true ' +
          '(ver docs/avisos-al-equipo.md), así que este caso no puede reproducirse ' +
          'aquí. Se verifica de verdad en CI, donde no hay .env.',
      );
      return;
    }

    await request(app.getHttpServer())
      .post('/achievements/dev-set-days')
      .set('x-user-id', patientId)
      .send({ days: 30 })
      .expect(403);
  });

  describe('no-regresión: otros endpoints de achievements siguen sin exigir token', () => {
    it('GET /achievements con solo x-user-id → 200', async () => {
      await request(app.getHttpServer())
        .get('/achievements')
        .set('x-user-id', patientId)
        .expect(200);
    });

    it('POST /achievements/relapse con solo x-user-id → 200', async () => {
      await request(app.getHttpServer())
        .post('/achievements/relapse')
        .set('x-user-id', patientId)
        .send({})
        .expect(200);
    });
  });
});
