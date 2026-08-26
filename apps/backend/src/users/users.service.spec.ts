import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { CheckIn } from '../check-ins/entities/check-in.entity';
import { AbstinencePeriod } from '../achievements/entities/abstinence-period.entity';

describe('UsersService', () => {
  let service: UsersService;
  let userRepo: { findOne: jest.Mock; find: jest.Mock };
  let checkInRepo: { findOne: jest.Mock; find: jest.Mock };
  let periodRepo: { findOne: jest.Mock };

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-15T12:00:00Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    userRepo = { findOne: jest.fn(), find: jest.fn() };
    checkInRepo = { findOne: jest.fn(), find: jest.fn() };
    periodRepo = { findOne: jest.fn() };

    service = new UsersService(
      userRepo as any,
      checkInRepo as any,
      periodRepo as any,
    );
  });

  describe('listPatients', () => {
    it('devuelve arreglo vacío cuando no hay pacientes', async () => {
      userRepo.find.mockResolvedValue([]);
      expect(await service.listPatients()).toEqual([]);
    });

    it('usa daysStreak del período actual cuando existe uno abierto', async () => {
      userRepo.find.mockResolvedValue([
        {
          id: 'patient-1',
          firstName: 'Carlos',
          lastName: 'Demo',
          email: 'demo@stopbet.cl',
          sedeId: 'Santiago',
          daysStreak: 3, // valor viejo en el usuario — no debe usarse si hay período abierto
          accountStatus: 'active',
          onboardingStatus: 'complete',
          createdAt: new Date('2025-01-01T00:00:00Z'),
        },
      ]);
      checkInRepo.findOne.mockResolvedValue(null);
      checkInRepo.find.mockResolvedValue([]);
      periodRepo.findOne.mockResolvedValue({ startDate: '2026-01-05', endDate: null });

      const result = await service.listPatients();

      expect(result).toHaveLength(1);
      expect(result[0].daysStreak).toBe(10); // 2026-01-05 → 2026-01-15
      expect(result[0].lastCheckIn).toBeNull();
    });

    it('cae al daysStreak del usuario cuando no hay período abierto', async () => {
      userRepo.find.mockResolvedValue([
        {
          id: 'patient-2',
          firstName: 'Ana',
          lastName: 'Pérez',
          email: 'ana@stopbet.cl',
          sedeId: 'Santiago',
          daysStreak: 78,
          accountStatus: 'active',
          onboardingStatus: 'complete',
          createdAt: new Date('2025-01-01T00:00:00Z'),
        },
      ]);
      checkInRepo.findOne.mockResolvedValue({ emotion: 'good', date: '2026-01-15' });
      checkInRepo.find.mockResolvedValue([]);
      periodRepo.findOne.mockResolvedValue(null);

      const result = await service.listPatients();

      expect(result[0].daysStreak).toBe(78);
      expect(result[0].lastCheckIn).toEqual({ emotion: 'good', date: '2026-01-15' });
    });
  });

  describe('getProgress', () => {
    it('lanza 404 si el usuario no existe', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.getProgress('no-existe')).rejects.toThrow(NotFoundException);
    });

    it('calcula el próximo hito por encima del daysStreak actual', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'patient-1', daysStreak: 12 });
      periodRepo.findOne.mockResolvedValue(null); // usa user.daysStreak = 12
      checkInRepo.findOne.mockResolvedValue(null);

      const result = await service.getProgress('patient-1');

      expect(result.daysStreak).toBe(12);
      expect(result.nextMilestone).toBe(30); // primer hito > 12
      expect(result.lastCheckIn).toBeNull();
    });

    it('usa el último hito como fallback cuando daysStreak lo supera a todos', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'patient-3', daysStreak: 400 });
      periodRepo.findOne.mockResolvedValue(null);
      checkInRepo.findOne.mockResolvedValue(null);

      const result = await service.getProgress('patient-3');

      expect(result.nextMilestone).toBe(365); // último hito de MILESTONES
    });

    it('prioriza el período actual sobre el daysStreak guardado en el usuario', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'patient-4', daysStreak: 999 });
      periodRepo.findOne.mockResolvedValue({ startDate: '2026-01-10', endDate: null });
      checkInRepo.findOne.mockResolvedValue(null);

      const result = await service.getProgress('patient-4');

      expect(result.daysStreak).toBe(5); // 2026-01-10 → 2026-01-15, no 999
    });
  });
});
