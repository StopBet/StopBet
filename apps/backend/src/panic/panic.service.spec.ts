import { NotFoundException } from '@nestjs/common';
import { PanicService } from './panic.service';

describe('PanicService', () => {
  let service: PanicService;
  let assignmentRepo: { findOne: jest.Mock; update: jest.Mock; save: jest.Mock; create: jest.Mock };
  let alertRepo: {
    findOne: jest.Mock; update: jest.Mock; save: jest.Mock; create: jest.Mock; find: jest.Mock;
  };
  let userRepo: { findOne: jest.Mock };
  let notificationRepo: { save: jest.Mock; create: jest.Mock };
  let communityService: { createPanicAlertPost: jest.Mock };

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-15T12:00:00Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    assignmentRepo = {
      findOne: jest.fn(),
      update: jest.fn(),
      save: jest.fn((v) => Promise.resolve(v)),
      create: jest.fn((v) => v),
    };
    alertRepo = {
      findOne: jest.fn(),
      update: jest.fn(),
      save: jest.fn((v) => Promise.resolve(v)),
      create: jest.fn((v) => ({ createdAt: new Date(), ...v })),
      find: jest.fn(),
    };
    userRepo = { findOne: jest.fn() };
    notificationRepo = { save: jest.fn((v) => Promise.resolve(v)), create: jest.fn((v) => v) };
    communityService = { createPanicAlertPost: jest.fn().mockResolvedValue(undefined) };

    service = new PanicService(
      assignmentRepo as any,
      alertRepo as any,
      userRepo as any,
      notificationRepo as any,
      communityService as any,
    );
  });

  describe('createAlert', () => {
    it('devuelve la alerta pending existente sin crear una nueva', async () => {
      const existing = { id: 'a1', patientId: 'p1', status: 'pending', createdAt: new Date() };
      alertRepo.findOne.mockResolvedValue(existing);

      const result = await service.createAlert('p1');

      expect(result.id).toBe('a1');
      expect(alertRepo.save).not.toHaveBeenCalled();
    });

    it('CA1.2: sin padrino activo, la alerta nace escalada de inmediato', async () => {
      alertRepo.findOne.mockResolvedValue(null);
      assignmentRepo.findOne.mockResolvedValue(null);

      const result = await service.createAlert('p1');

      expect(result.status).toBe('escalated');
      expect(result.sponsorId).toBeNull();
      expect(result.escalatedAt).not.toBeNull();
      expect(notificationRepo.save).not.toHaveBeenCalled();
    });

    it('con padrino activo crea la alerta pending y notifica al padrino con el nombre del paciente', async () => {
      alertRepo.findOne.mockResolvedValue(null);
      assignmentRepo.findOne.mockResolvedValue({ patientId: 'p1', sponsorId: 's1', isActive: true });
      userRepo.findOne.mockResolvedValue({ id: 'p1', firstName: 'Carlos', lastName: 'Demo' });

      const result = await service.createAlert('p1');

      expect(result.status).toBe('pending');
      expect(result.sponsorId).toBe('s1');
      expect(notificationRepo.save).toHaveBeenCalledTimes(1);
      const notif = notificationRepo.save.mock.calls[0][0];
      expect(notif.userId).toBe('s1');
      expect(notif.body).toContain('Carlos Demo');
    });

    it('si no encuentra al paciente, notifica al padrino con un nombre genérico', async () => {
      alertRepo.findOne.mockResolvedValue(null);
      assignmentRepo.findOne.mockResolvedValue({ patientId: 'p1', sponsorId: 's1', isActive: true });
      userRepo.findOne.mockResolvedValue(null);

      await service.createAlert('p1');

      const notif = notificationRepo.save.mock.calls[0][0];
      expect(notif.body).toContain('Un paciente');
    });

    it('cierra alertas responded/escalated previas antes de crear la nueva', async () => {
      alertRepo.findOne.mockResolvedValue(null);
      assignmentRepo.findOne.mockResolvedValue(null);

      await service.createAlert('p1');

      expect(alertRepo.update).toHaveBeenCalledWith(
        { patientId: 'p1', status: expect.anything() },
        expect.objectContaining({ status: 'cancelled' }),
      );
    });
  });

  describe('escalateExpiredAlerts (cron CA1.3)', () => {
    it('no hace nada si no hay alertas vencidas', async () => {
      alertRepo.find.mockResolvedValue([]);

      await service.escalateExpiredAlerts();

      expect(alertRepo.save).not.toHaveBeenCalled();
    });

    it('escala todas las alertas pending vencidas a los 120s', async () => {
      const expired = [
        { id: 'a1', status: 'pending', createdAt: new Date('2026-06-15T11:57:00Z') },
        { id: 'a2', status: 'pending', createdAt: new Date('2026-06-15T11:50:00Z') },
      ];
      alertRepo.find.mockResolvedValue(expired);

      await service.escalateExpiredAlerts();

      expect(alertRepo.save).toHaveBeenCalledWith(expired);
      expect(expired[0].status).toBe('escalated');
      expect(expired[1].status).toBe('escalated');
    });
  });

  describe('getActiveAlert', () => {
    it('devuelve alert y sponsor null si no hay ninguna alerta activa', async () => {
      alertRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

      const result = await service.getActiveAlert('u1');

      expect(result).toEqual({ alert: null, sponsor: null });
    });

    it('devuelve la alerta activa del paciente sin escalar si no ha vencido', async () => {
      const alert = {
        id: 'a1', patientId: 'p1', sponsorId: 's1', status: 'pending',
        createdAt: new Date('2026-06-15T11:59:30Z'), communityNotified: false,
      };
      alertRepo.findOne.mockResolvedValueOnce(alert);
      userRepo.findOne.mockResolvedValue({ id: 's1', firstName: 'Daniela', lastName: 'Soto', phone: null });

      const result = await service.getActiveAlert('p1');

      expect(result.alert?.status).toBe('pending');
      expect(result.sponsor?.firstName).toBe('Daniela');
      expect(alertRepo.save).not.toHaveBeenCalled();
    });

    it('CA1.3: si ya venció (>120s) la escala en el acto, no espera al cron', async () => {
      const alert = {
        id: 'a1', patientId: 'p1', sponsorId: null, status: 'pending',
        createdAt: new Date('2026-06-15T11:57:00Z'), communityNotified: false,
      };
      alertRepo.findOne.mockResolvedValueOnce(alert);

      const result = await service.getActiveAlert('p1');

      expect(result.alert?.status).toBe('escalated');
      expect(alertRepo.save).toHaveBeenCalledWith(alert);
    });

    it('si no es paciente, busca la alerta como padrino', async () => {
      const alert = {
        id: 'a1', patientId: 'p1', sponsorId: 'u1', status: 'pending',
        createdAt: new Date(), communityNotified: false,
      };
      alertRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(alert);
      userRepo.findOne.mockResolvedValue(null);

      const result = await service.getActiveAlert('u1');

      expect(result.alert?.id).toBe('a1');
    });
  });

  describe('respond / cancel / escalate', () => {
    it('respond: lanza NotFoundException si no hay alerta pending de ese padrino', async () => {
      alertRepo.findOne.mockResolvedValue(null);
      await expect(service.respond('a1', 's1')).rejects.toThrow(NotFoundException);
    });

    it('respond: marca la alerta como responded', async () => {
      alertRepo.findOne.mockResolvedValue({ id: 'a1', status: 'pending', createdAt: new Date() });
      const result = await service.respond('a1', 's1');
      expect(result.status).toBe('responded');
      expect(result.respondedAt).not.toBeNull();
    });

    it('cancel: lanza NotFoundException si no hay alerta activa del paciente', async () => {
      alertRepo.findOne.mockResolvedValue(null);
      await expect(service.cancel('a1', 'p1')).rejects.toThrow(NotFoundException);
    });

    it('cancel: marca la alerta como cancelled', async () => {
      alertRepo.findOne.mockResolvedValue({ id: 'a1', status: 'pending', createdAt: new Date() });
      const result = await service.cancel('a1', 'p1');
      expect(result.status).toBe('cancelled');
    });

    it('escalate: lanza NotFoundException si no hay alerta pending del paciente', async () => {
      alertRepo.findOne.mockResolvedValue(null);
      await expect(service.escalate('a1', 'p1')).rejects.toThrow(NotFoundException);
    });

    it('escalate: marca la alerta como escalated', async () => {
      alertRepo.findOne.mockResolvedValue({ id: 'a1', status: 'pending', createdAt: new Date() });
      const result = await service.escalate('a1', 'p1');
      expect(result.status).toBe('escalated');
    });
  });

  describe('notifyCommunity (CA5.1)', () => {
    it('lanza NotFoundException si no hay alerta pending de ese paciente', async () => {
      alertRepo.findOne.mockResolvedValue(null);
      await expect(service.notifyCommunity('a1', 'p1')).rejects.toThrow(NotFoundException);
    });

    it('si ya se notificó antes, no vuelve a crear el post', async () => {
      alertRepo.findOne.mockResolvedValue({ id: 'a1', communityNotified: true });

      const result = await service.notifyCommunity('a1', 'p1');

      expect(result).toEqual({ communityNotified: true });
      expect(communityService.createPanicAlertPost).not.toHaveBeenCalled();
    });

    it('si el paciente no tiene sede, no crea el post y devuelve false', async () => {
      alertRepo.findOne.mockResolvedValue({ id: 'a1', communityNotified: false });
      userRepo.findOne.mockResolvedValue({ id: 'p1', sedeId: null });

      const result = await service.notifyCommunity('a1', 'p1');

      expect(result).toEqual({ communityNotified: false });
      expect(communityService.createPanicAlertPost).not.toHaveBeenCalled();
    });

    it('crea el post en la comunidad y marca communityNotified antes de responder', async () => {
      const alert = { id: 'a1', communityNotified: false };
      alertRepo.findOne.mockResolvedValue(alert);
      userRepo.findOne.mockResolvedValue({ id: 'p1', sedeId: 'Santiago' });

      const result = await service.notifyCommunity('a1', 'p1');

      expect(communityService.createPanicAlertPost).toHaveBeenCalledWith('p1', 'Santiago');
      expect(alert.communityNotified).toBe(true);
      expect(result).toEqual({ communityNotified: true });
    });
  });

  describe('cancelActiveAlert', () => {
    it('devuelve cancelled false si no hay alerta activa', async () => {
      alertRepo.findOne.mockResolvedValue(null);
      const result = await service.cancelActiveAlert('p1');
      expect(result).toEqual({ cancelled: false });
    });

    it('cancela la alerta activa más reciente', async () => {
      alertRepo.findOne.mockResolvedValue({ id: 'a1', status: 'pending' });
      const result = await service.cancelActiveAlert('p1');
      expect(result).toEqual({ cancelled: true });
    });
  });

  describe('sponsor / historial / pendientes', () => {
    it('getSponsorInfo: devuelve null si no hay padrino activo', async () => {
      assignmentRepo.findOne.mockResolvedValue(null);
      expect(await service.getSponsorInfo('p1')).toBeNull();
    });

    it('getSponsorInfo: serializa el padrino activo', async () => {
      assignmentRepo.findOne.mockResolvedValue({
        sponsor: { id: 's1', firstName: 'Daniela', lastName: 'Soto', phone: '+56911111111' },
      });
      const result = await service.getSponsorInfo('p1');
      expect(result).toEqual({
        id: 's1', firstName: 'Daniela', lastName: 'Soto', phone: '+56911111111', isOnline: false,
      });
    });

    it('assignSponsor: desactiva la asignación anterior y crea la nueva activa', async () => {
      await service.assignSponsor({ patientId: 'p1', sponsorId: 's2' } as any);

      expect(assignmentRepo.update).toHaveBeenCalledWith(
        { patientId: 'p1', isActive: true },
        { isActive: false },
      );
      expect(assignmentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ patientId: 'p1', sponsorId: 's2', isActive: true }),
      );
    });

    it('listHistory: mapea el historial con datos del paciente', async () => {
      alertRepo.find.mockResolvedValue([
        {
          id: 'a1', patientId: 'p1', status: 'responded', communityNotified: false,
          createdAt: new Date(), respondedAt: new Date(), escalatedAt: null, cancelledAt: null,
          patient: { firstName: 'Carlos', lastName: 'Demo', sedeId: 'Santiago' },
        },
      ]);

      const [row] = await service.listHistory();

      expect(row.patientName).toBe('Carlos Demo');
      expect(row.sedeId).toBe('Santiago');
    });

    it('getPendingAlerts: devuelve las alertas pending de un padrino', async () => {
      alertRepo.find.mockResolvedValue([{ id: 'a1', status: 'pending', createdAt: new Date() }]);

      const result = await service.getPendingAlerts('s1');

      expect(result).toHaveLength(1);
      expect(alertRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { sponsorId: 's1', status: 'pending' } }),
      );
    });
  });
});
