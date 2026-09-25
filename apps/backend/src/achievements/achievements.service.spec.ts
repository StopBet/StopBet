import { AchievementsService } from './achievements.service';
import { daysAgoInChile } from '../common/chile-date';

describe('AchievementsService', () => {
  let service: AchievementsService;
  let periodRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
  };
  let badgeRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  let messageRepo: { count: jest.Mock; find: jest.Mock; save: jest.Mock; create: jest.Mock };
  let userRepo: { findOne: jest.Mock; update: jest.Mock };
  let notificationRepo: { save: jest.Mock; create: jest.Mock };
  let communityService: { createBadgeAnnouncementPost: jest.Mock };
  let pushService: { enviarAUsuarios: jest.Mock };

  beforeEach(() => {
    periodRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((v) => v),
      save: jest.fn((v) => Promise.resolve({ id: 'per-nuevo', ...v })),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    };
    badgeRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn((v) => Promise.resolve({ id: `b-${v.milestone}`, ...v })),
      create: jest.fn((v) => v),
      update: jest.fn(),
    };
    messageRepo = {
      count: jest.fn(),
      find: jest.fn().mockResolvedValue([{ body: 'mensaje validado' }]),
      save: jest.fn(),
      create: jest.fn((v) => v),
    };
    userRepo = { findOne: jest.fn(), update: jest.fn() };
    notificationRepo = { save: jest.fn(), create: jest.fn((v) => v) };
    communityService = { createBadgeAnnouncementPost: jest.fn().mockResolvedValue(undefined) };
    pushService = { enviarAUsuarios: jest.fn().mockResolvedValue(1) };

    service = new AchievementsService(
      periodRepo as any,
      badgeRepo as any,
      messageRepo as any,
      userRepo as any,
      notificationRepo as any,
      communityService as any,
      pushService as any,
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
  describe('otorgar insignias y avisar (HDU3 CA1)', () => {
    const periodoDe = (dias: number, earnedBadges: { milestone: number }[] = []) => ({
      id: 'per1',
      userId: 'p1',
      startDate: daysAgoInChile(dias),
      endDate: null,
      earnedBadges,
    });

    it('otorga los hitos cumplidos y avisa al paciente', async () => {
      const nuevas = await service.otorgarInsigniasDelPeriodo(periodoDe(7) as any);

      expect(nuevas.map((b) => b.milestone)).toEqual([1, 3, 7]);
      expect(pushService.enviarAUsuarios).toHaveBeenCalledTimes(1);
      const [userIds, title, body] = pushService.enviarAUsuarios.mock.calls[0];
      expect(userIds).toEqual(['p1']);
      expect(body).toContain('7 días');
      expect(title).toBeTruthy();
    });

    it('guarda la notificación en la app antes de mandar el push', async () => {
      await service.otorgarInsigniasDelPeriodo(periodoDe(3) as any);

      expect(notificationRepo.save).toHaveBeenCalledTimes(1);
      const guardada = notificationRepo.save.mock.calls[0][0];
      expect(guardada).toMatchObject({ userId: 'p1', type: 'success' });
      expect(notificationRepo.save.mock.invocationCallOrder[0]).toBeLessThan(
        pushService.enviarAUsuarios.mock.invocationCallOrder[0],
      );
    });

    it('no vuelve a avisar por un hito ya otorgado', async () => {
      const yaGanadas = [{ milestone: 1 }, { milestone: 3 }];

      const nuevas = await service.otorgarInsigniasDelPeriodo(periodoDe(3, yaGanadas) as any);

      expect(nuevas).toEqual([]);
      expect(badgeRepo.save).not.toHaveBeenCalled();
      expect(pushService.enviarAUsuarios).not.toHaveBeenCalled();
    });

    it('un fallo de Firebase no deja al paciente sin su insignia', async () => {
      pushService.enviarAUsuarios.mockRejectedValue(new Error('Firebase caído'));

      const nuevas = await service.otorgarInsigniasDelPeriodo(periodoDe(1) as any);

      expect(nuevas.map((b) => b.milestone)).toEqual([1]);
      expect(notificationRepo.save).toHaveBeenCalledTimes(1);
    });

    it('no felicita al cerrar el período por una recaída', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'p1' });
      periodRepo.findOne.mockResolvedValue({
        id: 'per1',
        userId: 'p1',
        startDate: daysAgoInChile(7),
        endDate: null,
      });

      await service.reportRelapse('p1');

      expect(badgeRepo.save).toHaveBeenCalled();
      expect(pushService.enviarAUsuarios).not.toHaveBeenCalled();
      expect(notificationRepo.save).not.toHaveBeenCalled();
    });
  });
});
