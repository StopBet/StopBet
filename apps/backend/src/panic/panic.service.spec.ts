import { NotFoundException } from '@nestjs/common';
import { PanicService } from './panic.service';

describe('PanicService', () => {
  let service: PanicService;
  let assignmentRepo: {
    findOne: jest.Mock; find: jest.Mock; update: jest.Mock; save: jest.Mock; create: jest.Mock;
  };
  let designationRepo: { findOne: jest.Mock };
  let alertRepo: {
    findOne: jest.Mock; update: jest.Mock; save: jest.Mock; create: jest.Mock; find: jest.Mock;
  };
  let userRepo: { findOne: jest.Mock };
  let notificationRepo: { save: jest.Mock; create: jest.Mock };
  let communityService: { createPanicAlertPost: jest.Mock };
  let sponsorService: { assign: jest.Mock };
  let push: { enviarAUsuarios: jest.Mock };

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
      find: jest.fn(),
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
    designationRepo = { findOne: jest.fn() };
    userRepo = { findOne: jest.fn() };
    notificationRepo = { save: jest.fn((v) => Promise.resolve(v)), create: jest.fn((v) => v) };
    communityService = { createPanicAlertPost: jest.fn().mockResolvedValue(undefined) };
    sponsorService = { assign: jest.fn().mockResolvedValue(undefined) };
    push = { enviarAUsuarios: jest.fn().mockResolvedValue(1) };

    service = new PanicService(
      assignmentRepo as any,
      alertRepo as any,
      userRepo as any,
      notificationRepo as any,
      communityService as any,
      sponsorService as any,
      push as any,
      designationRepo as any,
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
      // Abre la pantalla del compañero, no el botón SOS del paciente.
      expect(notif.target).toBe('sponsor-alert');
    });

    it('hace sonar el teléfono del compañero de viaje, por el canal de pánico y sin nombrar a nadie', async () => {
      alertRepo.findOne.mockResolvedValue(null);
      assignmentRepo.findOne.mockResolvedValue({ patientId: 'p1', sponsorId: 's1', isActive: true });
      userRepo.findOne.mockResolvedValue({ id: 'p1', firstName: 'Carlos', lastName: 'Demo' });

      await service.createAlert('p1');

      expect(push.enviarAUsuarios).toHaveBeenCalledWith(['s1'], 'Alerta de pánico', expect.any(String), 'panic_alerts');
      // La pantalla de bloqueo la ve cualquiera: el push no lleva el nombre del paciente.
      expect(push.enviarAUsuarios.mock.calls[0][2]).not.toContain('Carlos');
    });

    it('si el push falla, la alerta se crea igual', async () => {
      alertRepo.findOne.mockResolvedValue(null);
      assignmentRepo.findOne.mockResolvedValue({ patientId: 'p1', sponsorId: 's1', isActive: true });
      userRepo.findOne.mockResolvedValue({ id: 'p1', firstName: 'Carlos', lastName: 'Demo' });
      push.enviarAUsuarios.mockRejectedValue(new Error('Firebase caído'));

      await expect(service.createAlert('p1')).resolves.toMatchObject({ status: 'pending', sponsorId: 's1' });
    });

    it('sin compañero de viaje no manda push a nadie', async () => {
      alertRepo.findOne.mockResolvedValue(null);
      assignmentRepo.findOne.mockResolvedValue(null);

      await service.createAlert('p1');

      expect(push.enviarAUsuarios).not.toHaveBeenCalled();
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
      alertRepo.findOne.mockResolvedValue(null);

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

    it('no devuelve la alerta de otra persona aunque el usuario figure como su compañero de viaje', async () => {
      alertRepo.findOne.mockResolvedValue(null);

      const result = await service.getActiveAlert('s1');

      expect(result).toEqual({ alert: null, sponsor: null });
      // Una sola búsqueda, por paciente: ya no hay respaldo por sponsorId.
      expect(alertRepo.findOne).toHaveBeenCalledTimes(1);
      expect(alertRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ patientId: 's1' }) }),
      );
    });
  });

  describe('getAccompanied', () => {
    const carlos = {
      id: 'p1', firstName: 'Carlos', lastName: 'Demo', phone: '+56911111111', accountStatus: 'active',
    };

    it('un paciente común no está designado y no acompaña a nadie', async () => {
      designationRepo.findOne.mockResolvedValue(null);
      assignmentRepo.find.mockResolvedValue([]);

      const result = await service.getAccompanied('u1');

      expect(result).toEqual({ designated: false, patients: [] });
      expect(alertRepo.find).not.toHaveBeenCalled();
    });

    it('designado sin pacientes asignados: designated true y lista vacía', async () => {
      designationRepo.findOne.mockResolvedValue({ id: 'd1' });
      assignmentRepo.find.mockResolvedValue([]);

      const result = await service.getAccompanied('s1');

      expect(result).toEqual({ designated: true, patients: [] });
    });

    it('devuelve nombre y teléfono de cada persona y su alerta pendiente', async () => {
      designationRepo.findOne.mockResolvedValue({ id: 'd1' });
      assignmentRepo.find.mockResolvedValue([{ patient: carlos }]);
      alertRepo.find.mockResolvedValue([
        {
          id: 'a1', patientId: 'p1', sponsorId: 's1', status: 'pending',
          createdAt: new Date('2026-06-15T11:59:30Z'), communityNotified: false,
        },
      ]);

      const result = await service.getAccompanied('s1');

      expect(result.designated).toBe(true);
      expect(result.patients).toHaveLength(1);
      expect(result.patients[0]).toMatchObject({
        id: 'p1', firstName: 'Carlos', lastName: 'Demo', phone: '+56911111111',
        recentAlert: { id: 'a1', status: 'pending' },
      });
      expect(alertRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ sponsorId: 's1' }),
          order: { createdAt: 'DESC' },
        }),
      );
    });

    it('solo expone nombre y teléfono del paciente, nada de su progreso', async () => {
      designationRepo.findOne.mockResolvedValue({ id: 'd1' });
      assignmentRepo.find.mockResolvedValue([
        { patient: { ...carlos, email: 'carlos@stopbet.cl', rut: 'cifrado', sedeId: 'Santiago' } },
      ]);
      alertRepo.find.mockResolvedValue([]);

      const [patient] = (await service.getAccompanied('s1')).patients;

      expect(Object.keys(patient).sort()).toEqual(['firstName', 'id', 'lastName', 'phone', 'recentAlert']);
    });

    it('con varias alertas recientes de la misma persona se queda con la más nueva', async () => {
      designationRepo.findOne.mockResolvedValue({ id: 'd1' });
      assignmentRepo.find.mockResolvedValue([{ patient: carlos }]);
      alertRepo.find.mockResolvedValue([
        { id: 'nueva', patientId: 'p1', status: 'responded', createdAt: new Date('2026-06-15T11:59:00Z') },
        { id: 'vieja', patientId: 'p1', status: 'cancelled', createdAt: new Date('2026-06-15T11:50:00Z') },
      ]);

      const [patient] = (await service.getAccompanied('s1')).patients;

      expect(patient.recentAlert?.id).toBe('nueva');
    });

    it('CA1.3: una alerta pendiente que ya venció se escala en el acto', async () => {
      designationRepo.findOne.mockResolvedValue({ id: 'd1' });
      assignmentRepo.find.mockResolvedValue([{ patient: carlos }]);
      const vencida = {
        id: 'a1', patientId: 'p1', sponsorId: 's1', status: 'pending',
        createdAt: new Date('2026-06-15T11:57:00Z'), communityNotified: false,
      };
      alertRepo.find.mockResolvedValue([vencida]);

      const [patient] = (await service.getAccompanied('s1')).patients;

      expect(patient.recentAlert?.status).toBe('escalated');
      expect(alertRepo.save).toHaveBeenCalledWith(vencida);
    });

    it('no lista a quien tiene la cuenta suspendida', async () => {
      designationRepo.findOne.mockResolvedValue({ id: 'd1' });
      assignmentRepo.find.mockResolvedValue([
        { patient: { ...carlos, accountStatus: 'suspended' } },
      ]);

      const result = await service.getAccompanied('s1');

      expect(result.patients).toEqual([]);
      expect(alertRepo.find).not.toHaveBeenCalled();
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

    // La escritura se movió a SponsorDesignationService (HU-20) para que exista una
    // sola forma de asignar, con las validaciones del CA20.2. Lo que se desactiva y
    // lo que se crea está probado en `sponsor-designation.service.spec.ts`; acá solo
    // queda verificar que la ruta vieja siga entrando por ahí.
    it('assignSponsor: delega en el servicio de compañeros de viaje', async () => {
      await service.assignSponsor({ patientId: 'p1', sponsorId: 's2' } as any);

      expect(sponsorService.assign).toHaveBeenCalledWith('p1', 's2');
      expect(assignmentRepo.save).not.toHaveBeenCalled();
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
