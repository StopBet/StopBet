import { AchievementsService } from './achievements.service';

describe('AchievementsService', () => {
  let service: AchievementsService;
  let periodRepo: { findOne: jest.Mock };
  let badgeRepo: { findOne: jest.Mock; update: jest.Mock };
  let messageRepo: { count: jest.Mock; save: jest.Mock; create: jest.Mock };
  let userRepo: { findOne: jest.Mock };
  let communityService: { createBadgeAnnouncementPost: jest.Mock };

  beforeEach(() => {
    periodRepo = { findOne: jest.fn() };
    badgeRepo = { findOne: jest.fn(), update: jest.fn() };
    messageRepo = { count: jest.fn(), save: jest.fn(), create: jest.fn((v) => v) };
    userRepo = { findOne: jest.fn() };
    communityService = { createBadgeAnnouncementPost: jest.fn().mockResolvedValue(undefined) };

    service = new AchievementsService(
      periodRepo as any,
      badgeRepo as any,
      messageRepo as any,
      userRepo as any,
      communityService as any,
    );
  });

  describe('shareBadge (CA5.2)', () => {
    it('publica el anuncio en el foro de la sede y marca la insignia', async () => {
      periodRepo.findOne.mockResolvedValue({ id: 'per1' });
      badgeRepo.findOne.mockResolvedValue({ id: 'b1', milestone: 7, sharedToCommunity: false });
      userRepo.findOne.mockResolvedValue({ id: 'p1', sedeId: 'sede-1' });

      await service.shareBadge('p1', 7);

      expect(communityService.createBadgeAnnouncementPost).toHaveBeenCalledWith('p1', 7, 'sede-1');
      expect(badgeRepo.update).toHaveBeenCalledWith({ id: 'b1' }, { sharedToCommunity: true });
    });

    it('no publica un segundo anuncio si la insignia ya se compartió', async () => {
      periodRepo.findOne.mockResolvedValue({ id: 'per1' });
      badgeRepo.findOne.mockResolvedValue({ id: 'b1', milestone: 7, sharedToCommunity: true });

      await service.shareBadge('p1', 7);

      expect(communityService.createBadgeAnnouncementPost).not.toHaveBeenCalled();
      expect(badgeRepo.update).not.toHaveBeenCalled();
    });

    it('publica el hito re-ganado en el período nuevo tras una recaída', async () => {
      periodRepo.findOne.mockResolvedValue({ id: 'per2' });
      badgeRepo.findOne.mockResolvedValue({ id: 'b2', milestone: 7, sharedToCommunity: false });
      userRepo.findOne.mockResolvedValue({ id: 'p1', sedeId: 'sede-1' });

      await service.shareBadge('p1', 7);

      expect(badgeRepo.findOne).toHaveBeenCalledWith({
        where: { userId: 'p1', milestone: 7, periodId: 'per2' },
      });
      expect(communityService.createBadgeAnnouncementPost).toHaveBeenCalledWith('p1', 7, 'sede-1');
    });

    it('sin sede no hay foro donde publicar: no marca la insignia como compartida', async () => {
      periodRepo.findOne.mockResolvedValue({ id: 'per1' });
      badgeRepo.findOne.mockResolvedValue({ id: 'b1', milestone: 7, sharedToCommunity: false });
      userRepo.findOne.mockResolvedValue({ id: 'p1', sedeId: null });

      await service.shareBadge('p1', 7);

      expect(communityService.createBadgeAnnouncementPost).not.toHaveBeenCalled();
      expect(badgeRepo.update).not.toHaveBeenCalled();
    });
  });
});
