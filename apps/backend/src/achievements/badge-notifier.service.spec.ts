import { BadgeNotifierService } from './badge-notifier.service';

describe('BadgeNotifierService (HDU3 CA1)', () => {
  let service: BadgeNotifierService;
  let periodRepo: { find: jest.Mock };
  let achievementsService: { otorgarInsigniasDelPeriodo: jest.Mock };

  beforeEach(() => {
    periodRepo = { find: jest.fn().mockResolvedValue([]) };
    achievementsService = {
      otorgarInsigniasDelPeriodo: jest.fn().mockResolvedValue([]),
    };

    service = new BadgeNotifierService(periodRepo as any, achievementsService as any);
  });

  it('evalúa todos los períodos abiertos', async () => {
    periodRepo.find.mockResolvedValue([{ id: 'per1' }, { id: 'per2' }]);
    achievementsService.otorgarInsigniasDelPeriodo.mockResolvedValue([{ milestone: 7 }]);

    expect(await service.otorgarInsigniasDelDia()).toBe(2);
    expect(achievementsService.otorgarInsigniasDelPeriodo).toHaveBeenCalledTimes(2);
  });

  it('no toca los períodos ya cerrados', async () => {
    await service.otorgarInsigniasDelDia();

    expect(periodRepo.find.mock.calls[0][0].where.endDate).toBeDefined();
    expect(periodRepo.find.mock.calls[0][0].relations).toContain('earnedBadges');
  });

  it('un período roto no deja sin insignia a los siguientes', async () => {
    periodRepo.find.mockResolvedValue([{ id: 'per1' }, { id: 'per2' }]);
    achievementsService.otorgarInsigniasDelPeriodo
      .mockRejectedValueOnce(new Error('datos corruptos'))
      .mockResolvedValueOnce([{ milestone: 3 }]);

    expect(await service.otorgarInsigniasDelDia()).toBe(1);
  });

  it('no falla si no hay períodos abiertos', async () => {
    expect(await service.otorgarInsigniasDelDia()).toBe(0);
  });
});
