import { DemoService, DEMO_PATIENT_ID, DEMO_SPONSOR_ID } from './demo.service';
import { EXTRA_DEMO_PATIENTS } from './demo-patients';

describe('DemoService', () => {
  let env: Record<string, string | undefined>;
  let alertRepo: { find: jest.Mock; save: jest.Mock; update: jest.Mock };
  let sponsorRepo: { update: jest.Mock };
  let checkInRepo: { delete: jest.Mock };
  let muteRepo: { delete: jest.Mock };
  let reportRepo: { find: jest.Mock; delete: jest.Mock };
  let postRepo: { decrement: jest.Mock };
  let periodRepo: { findOne: jest.Mock };
  let badgeRepo: { update: jest.Mock };
  let userRepo: { exist: jest.Mock };
  let dataSource: { getRepository: jest.Mock; transaction: jest.Mock };
  let service: DemoService;

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-23T15:00:00Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    env = {};
    alertRepo = {
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn((v) => Promise.resolve(v)),
      update: jest.fn(),
    };
    sponsorRepo = { update: jest.fn() };
    checkInRepo = { delete: jest.fn() };
    muteRepo = { delete: jest.fn() };
    reportRepo = { find: jest.fn().mockResolvedValue([]), delete: jest.fn() };
    postRepo = { decrement: jest.fn() };
    periodRepo = { findOne: jest.fn().mockResolvedValue({ id: 'period-1' }) };
    badgeRepo = { update: jest.fn() };
    userRepo = { exist: jest.fn() };
    dataSource = { getRepository: jest.fn(() => userRepo), transaction: jest.fn() };
    service = new DemoService(
      { get: (key: string) => env[key] } as any,
      dataSource as any,
      alertRepo as any,
      sponsorRepo as any,
      checkInRepo as any,
      muteRepo as any,
      reportRepo as any,
      postRepo as any,
      periodRepo as any,
      badgeRepo as any,
    );
  });

  describe('answerAsDemoSponsor', () => {
    it('no hace nada sin DEMO_PADRINO_SEGUNDOS', async () => {
      await service.answerAsDemoSponsor();
      expect(alertRepo.find).not.toHaveBeenCalled();
    });

    it.each(['abc', '-1', '120'])('ignora un valor inválido (%s)', async (value) => {
      env.DEMO_PADRINO_SEGUNDOS = value;
      await service.answerAsDemoSponsor();
      expect(alertRepo.find).not.toHaveBeenCalled();
    });

    it('responde como Daniela solo las alertas pendientes que ya cumplieron el plazo', async () => {
      env.DEMO_PADRINO_SEGUNDOS = '45';
      const alert = { id: 'a1', sponsorId: DEMO_SPONSOR_ID, status: 'pending', respondedAt: null };
      alertRepo.find.mockResolvedValue([alert]);

      await service.answerAsDemoSponsor();

      const where = alertRepo.find.mock.calls[0][0].where;
      expect(where.sponsorId).toBe(DEMO_SPONSOR_ID);
      expect(where.status).toBe('pending');
      expect(where.createdAt.value).toEqual(new Date('2026-09-23T14:59:15Z'));
      expect(alertRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'a1', status: 'responded', respondedAt: expect.any(Date) }),
      ]);
    });
  });

  describe('onLogin', () => {
    it('no reinicia nada sin DEMO_RESET_ON_LOGIN=true', async () => {
      await service.onLogin(DEMO_PATIENT_ID);
      expect(checkInRepo.delete).not.toHaveBeenCalled();
    });

    it('no toca a otros usuarios aunque la variable esté encendida', async () => {
      env.DEMO_RESET_ON_LOGIN = 'true';
      await service.onLogin('otro-paciente');
      expect(checkInRepo.delete).not.toHaveBeenCalled();
      expect(alertRepo.update).not.toHaveBeenCalled();
    });

    it('deja la cuenta de Carlos como después de seed:demo --reset', async () => {
      env.DEMO_RESET_ON_LOGIN = 'true';
      reportRepo.find.mockResolvedValue([{ id: 'r1', postId: 'post-1' }]);

      await service.onLogin(DEMO_PATIENT_ID);

      expect(sponsorRepo.update).toHaveBeenCalledWith(
        { patientId: DEMO_PATIENT_ID, sponsorId: DEMO_SPONSOR_ID },
        { isActive: true },
      );
      expect(alertRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ patientId: DEMO_PATIENT_ID }),
        expect.objectContaining({ status: 'cancelled' }),
      );
      expect(checkInRepo.delete).toHaveBeenCalledWith({ userId: DEMO_PATIENT_ID, date: '2026-09-23' });
      expect(muteRepo.delete).toHaveBeenCalledWith({ userId: DEMO_PATIENT_ID });
      expect(reportRepo.delete).toHaveBeenCalledWith('r1');
      expect(postRepo.decrement).toHaveBeenCalledWith({ id: 'post-1' }, 'reportCount', 1);
      expect(badgeRepo.update).toHaveBeenCalledWith(
        { periodId: 'period-1', milestone: 45 },
        { sharedToCommunity: false },
      );
    });

    it('reinicia también a las copias de Carlos, cada una por su cuenta', async () => {
      env.DEMO_RESET_ON_LOGIN = 'true';
      const copia = EXTRA_DEMO_PATIENTS[0].id;

      await service.onLogin(copia);

      expect(checkInRepo.delete).toHaveBeenCalledWith({ userId: copia, date: '2026-09-23' });
      expect(alertRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ patientId: copia }),
        expect.anything(),
      );
    });

    it('no hace fallar el login si el reinicio falla', async () => {
      env.DEMO_RESET_ON_LOGIN = 'true';
      sponsorRepo.update.mockRejectedValue(new Error('BD caída'));
      await expect(service.onLogin(DEMO_PATIENT_ID)).resolves.toBeUndefined();
    });
  });

  describe('onApplicationBootstrap', () => {
    it('no crea copias sin DEMO_PACIENTES_EXTRA=true', async () => {
      await service.onApplicationBootstrap();
      expect(userRepo.exist).not.toHaveBeenCalled();
    });

    it('crea solo las copias que faltan', async () => {
      env.DEMO_PACIENTES_EXTRA = 'true';
      const [, segunda] = EXTRA_DEMO_PATIENTS;
      userRepo.exist.mockImplementation(({ where }) =>
        Promise.resolve(where.id === DEMO_PATIENT_ID || where.id === segunda.id),
      );

      await service.onApplicationBootstrap();

      expect(dataSource.transaction).toHaveBeenCalledTimes(EXTRA_DEMO_PATIENTS.length - 1);
    });

    it('no crea nada si Carlos todavía no existe', async () => {
      env.DEMO_PACIENTES_EXTRA = 'true';
      userRepo.exist.mockResolvedValue(false);

      await service.onApplicationBootstrap();

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });
});
