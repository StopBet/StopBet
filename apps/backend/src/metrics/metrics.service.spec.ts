import { MetricsService } from './metrics.service';
import { CheckIn } from '../check-ins/entities/check-in.entity';
import { PanicAlert } from '../panic/entities/panic-alert.entity';

describe('MetricsService', () => {
  let service: MetricsService;
  let checkInRepo: { find: jest.Mock };
  let panicAlertRepo: { count: jest.Mock };

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-15T12:00:00Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    checkInRepo = { find: jest.fn() };
    panicAlertRepo = { count: jest.fn() };

    service = new MetricsService(checkInRepo as any, panicAlertRepo as any);
  });

  describe('getPatientMetrics', () => {
    it('devuelve moodAvg null (no 0) cuando el paciente no tiene check-ins', async () => {
      checkInRepo.find.mockResolvedValue([]);
      panicAlertRepo.count.mockResolvedValue(0);

      const result = await service.getPatientMetrics('patient-1');

      expect(result).toEqual({
        evolution: [],
        totalCheckIns: 0,
        panicCount: 0,
        moodAvg: null,
      });
    });

    it('calcula evolution, totalCheckIns y moodAvg redondeado a 1 decimal', async () => {
      const checkIns: Partial<CheckIn>[] = [
        { date: '2026-06-01', emotion: 'good' },   // 5
        { date: '2026-06-02', emotion: 'tired' },  // 3
        { date: '2026-06-03', emotion: 'anxious' }, // 2
      ];
      checkInRepo.find.mockResolvedValue(checkIns);
      panicAlertRepo.count.mockResolvedValue(0);

      const result = await service.getPatientMetrics('patient-1');

      expect(result.evolution).toEqual([
        { date: '2026-06-01', mood: 5 },
        { date: '2026-06-02', mood: 3 },
        { date: '2026-06-03', mood: 2 },
      ]);
      expect(result.totalCheckIns).toBe(3);
      expect(result.moodAvg).toBeCloseTo(3.3, 1);
    });

    it('cuenta panicCount solo del periodo de 30 días, no el historico', async () => {
      checkInRepo.find.mockResolvedValue([]);
      panicAlertRepo.count.mockResolvedValue(2);

      const result = await service.getPatientMetrics('patient-1');

      expect(result.panicCount).toBe(2);
      const [callArgs] = panicAlertRepo.count.mock.calls[0];
      expect(callArgs.where.patientId).toBe('patient-1');
      expect(callArgs.where.createdAt).toBeDefined();
    });

    it('consulta check-ins acotados a los ultimos 30 dias del paciente pedido', async () => {
      checkInRepo.find.mockResolvedValue([]);
      panicAlertRepo.count.mockResolvedValue(0);

      await service.getPatientMetrics('patient-42');

      const [callArgs] = checkInRepo.find.mock.calls[0];
      expect(callArgs.where.userId).toBe('patient-42');
      expect(callArgs.where.date).toBeDefined();
    });
  });
});