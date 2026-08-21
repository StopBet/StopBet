import { CheckInReminderService } from './check-in-reminder.service';

describe('CheckInReminderService (CA7.4)', () => {
  let service: CheckInReminderService;
  let checkInRepo: { find: jest.Mock };
  let userRepo: { find: jest.Mock };
  let notificationRepo: { find: jest.Mock; create: jest.Mock; save: jest.Mock };
  let pushService: { enviarAUsuarios: jest.Mock };

  beforeEach(() => {
    checkInRepo = { find: jest.fn().mockResolvedValue([]) };
    userRepo = { find: jest.fn().mockResolvedValue([]) };
    notificationRepo = {
      find: jest.fn(),
      create: jest.fn((v) => v),
      save: jest.fn((v) => Promise.resolve(v)),
    };
    pushService = { enviarAUsuarios: jest.fn().mockResolvedValue(0) };

    service = new CheckInReminderService(
      checkInRepo as any,
      userRepo as any,
      notificationRepo as any,
      pushService as any,
    );
  });

  it('notifica solo a quienes no registraron su check-in', async () => {
    userRepo.find.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }]);
    checkInRepo.find.mockResolvedValue([{ userId: 'p2' }]);

    const notified = await service.remindPendingCheckIns();

    expect(notified).toBe(2);
    const saved = notificationRepo.save.mock.calls[0][0];
    expect(saved.map((n: { userId: string }) => n.userId)).toEqual(['p1', 'p3']);
  });

  it('no envía nada si todos ya registraron', async () => {
    userRepo.find.mockResolvedValue([{ id: 'p1' }]);
    checkInRepo.find.mockResolvedValue([{ userId: 'p1' }]);

    expect(await service.remindPendingCheckIns()).toBe(0);
    expect(notificationRepo.save).not.toHaveBeenCalled();
  });

  it('no falla si no hay pacientes', async () => {
    expect(await service.remindPendingCheckIns()).toBe(0);
    expect(notificationRepo.save).not.toHaveBeenCalled();
  });

  describe('CA7.4 — el push es lo que llega sin abrir la app', () => {
    it('envía push solo a quienes no registraron su check-in', async () => {
      userRepo.find.mockResolvedValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
      checkInRepo.find.mockResolvedValue([{ userId: 'b' }]);

      await service.remindPendingCheckIns();

      expect(pushService.enviarAUsuarios).toHaveBeenCalledWith(
        ['a', 'c'],
        expect.any(String),
        expect.any(String),
      );
    });

    it('no envía nada si todos ya registraron', async () => {
      userRepo.find.mockResolvedValue([{ id: 'a' }]);
      checkInRepo.find.mockResolvedValue([{ userId: 'a' }]);

      await service.remindPendingCheckIns();

      expect(pushService.enviarAUsuarios).not.toHaveBeenCalled();
    });

    // Un fallo de Firebase no puede tumbar el recordatorio: la notificación en la
    // tabla ya se guardó y el paciente la ve igual al abrir la app.
    it('si el push falla, el cron termina bien y la notificación queda guardada', async () => {
      userRepo.find.mockResolvedValue([{ id: 'a' }]);
      checkInRepo.find.mockResolvedValue([]);
      pushService.enviarAUsuarios.mockRejectedValue(new Error('Firebase caído'));

      await expect(service.remindPendingCheckIns()).resolves.toBe(1);
      expect(notificationRepo.save).toHaveBeenCalled();
    });
  });
});
