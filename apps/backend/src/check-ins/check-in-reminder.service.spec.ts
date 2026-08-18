import { CheckInReminderService } from './check-in-reminder.service';

describe('CheckInReminderService (CA7.4)', () => {
  let service: CheckInReminderService;
  let checkInRepo: { find: jest.Mock };
  let userRepo: { find: jest.Mock };
  let notificationRepo: { find: jest.Mock; create: jest.Mock; save: jest.Mock };

  beforeEach(() => {
    checkInRepo = { find: jest.fn().mockResolvedValue([]) };
    userRepo = { find: jest.fn().mockResolvedValue([]) };
    notificationRepo = {
      find: jest.fn(),
      create: jest.fn((v) => v),
      save: jest.fn((v) => Promise.resolve(v)),
    };
    service = new CheckInReminderService(
      checkInRepo as any,
      userRepo as any,
      notificationRepo as any,
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
});
