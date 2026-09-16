import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { CheckIn } from '../check-ins/entities/check-in.entity';
import { AbstinencePeriod } from '../achievements/entities/abstinence-period.entity';

describe('UsersService', () => {
  let service: UsersService;
  let userRepo: { findOne: jest.Mock; find: jest.Mock };
  let checkInRepo: { findOne: jest.Mock; find: jest.Mock };
  let periodRepo: { findOne: jest.Mock };
  let assignmentRepo: { find: jest.Mock };

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
    assignmentRepo = { find: jest.fn().mockResolvedValue([]) };

    service = new UsersService(
      userRepo as any,
      checkInRepo as any,
      periodRepo as any,
      assignmentRepo as any,
    );
  });

  describe('listPatients', () => {
    it('devuelve arreglo vacío cuando no hay pacientes', async () => {
      userRepo.find.mockResolvedValue([]);
      expect(await service.listPatients()).toEqual([]);
    });

    // El psicólogo solo puede ver a los suyos: antes la lista completa se le entregaba a
    // cualquiera de los dos roles, con correo e historial de pacientes ajenos.
    it('a un psicólogo le filtra por sus asignaciones activas', async () => {
      assignmentRepo.find.mockResolvedValue([
        { patientId: 'patient-1' },
        { patientId: 'patient-2' },
      ]);
      userRepo.find.mockResolvedValue([]);

      await service.listPatients({ id: 'psy-1', role: 'psychologist' } as any);

      expect(assignmentRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { psychologistId: 'psy-1', active: true } }),
      );
      const where = userRepo.find.mock.calls[0][0].where as Array<{ id?: unknown }>;
      expect(where.every(w => w.id !== undefined)).toBe(true);
    });

    it('un psicólogo sin pacientes asignados no consulta usuarios', async () => {
      assignmentRepo.find.mockResolvedValue([]);

      expect(
        await service.listPatients({ id: 'psy-sin', role: 'psychologist' } as any),
      ).toEqual([]);
      expect(userRepo.find).not.toHaveBeenCalled();
    });

    // Rol administrativo: si también filtrara, una sede sin psicólogos no tendría quién la mire.
    it('a un coordinador no le filtra nada', async () => {
      userRepo.find.mockResolvedValue([]);

      await service.listPatients({ id: 'coord-1', role: 'coordinator' } as any);

      expect(assignmentRepo.find).not.toHaveBeenCalled();
      const where = userRepo.find.mock.calls[0][0].where;
      expect(where.every((w: { role: string; id?: unknown }) => w.role === 'patient' && w.id === undefined)).toBe(true);
    });

    // `registration.submit` crea el usuario con rol patient antes de la revisión: sin
    // excluirlo, un postulante aparecía como paciente en el panel del coordinador.
    it('excluye a quien todavía espera la aprobación de su solicitud', async () => {
      userRepo.find.mockResolvedValue([]);

      await service.listPatients({ id: 'coord-1', role: 'coordinator' } as any);

      const where = userRepo.find.mock.calls[0][0].where as Array<Record<string, any>>;
      const excluyePendientes = where.some(
        w => w.onboardingStatus?._type === 'not' && w.onboardingStatus?._value === 'approval_pending',
      );
      const conservaNulos = where.some(w => w.onboardingStatus?._type === 'isNull');
      expect(excluyePendientes).toBe(true);
      expect(conservaNulos).toBe(true);
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
