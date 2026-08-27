import { PanicController } from './panic.controller';
import { PanicService } from './panic.service';

// El controlador es una capa de delegación: no tiene lógica propia, pero sí
// decide qué argumento de la petición recibe cada método del servicio. Estos
// tests fijan ese cableado, que es donde se cuelan los errores de este tipo de
// capa (pasar el id del padrino donde iba el del paciente, por ejemplo).
describe('PanicController', () => {
  let controller: PanicController;
  let service: jest.Mocked<Pick<
    PanicService,
    | 'getSponsorInfo'
    | 'assignSponsor'
    | 'createAlert'
    | 'listHistory'
    | 'getActiveAlert'
    | 'getPendingAlerts'
    | 'respond'
    | 'cancelActiveAlert'
    | 'cancel'
    | 'escalate'
    | 'notifyCommunity'
  >>;

  const PACIENTE = 'paciente-1';
  const PADRINO = 'padrino-1';
  const ALERTA = 'alerta-1';

  beforeEach(() => {
    service = {
      getSponsorInfo: jest.fn().mockResolvedValue(null),
      assignSponsor: jest.fn().mockResolvedValue(undefined),
      createAlert: jest.fn().mockResolvedValue({ id: ALERTA }),
      listHistory: jest.fn().mockResolvedValue([]),
      getActiveAlert: jest.fn().mockResolvedValue({ alert: null }),
      getPendingAlerts: jest.fn().mockResolvedValue([]),
      respond: jest.fn().mockResolvedValue({ id: ALERTA, status: 'responded' }),
      cancelActiveAlert: jest.fn().mockResolvedValue({ cancelled: true }),
      cancel: jest.fn().mockResolvedValue({ id: ALERTA, status: 'cancelled' }),
      escalate: jest.fn().mockResolvedValue({ id: ALERTA, status: 'escalated' }),
      notifyCommunity: jest.fn().mockResolvedValue({ communityNotified: true }),
    } as unknown as typeof service;

    controller = new PanicController(service as unknown as PanicService);
  });

  describe('padrino', () => {
    it('getSponsorInfo consulta por el usuario de la cabecera', async () => {
      await controller.getSponsorInfo(PACIENTE);
      expect(service.getSponsorInfo).toHaveBeenCalledWith(PACIENTE);
    });

    it('assignSponsor pasa el dto completo', async () => {
      const dto = { patientId: PACIENTE, sponsorId: PADRINO };
      await controller.assignSponsor(dto);
      expect(service.assignSponsor).toHaveBeenCalledWith(dto);
    });
  });

  describe('alertas', () => {
    it('createAlert usa el id del paciente que viene en la cabecera', async () => {
      await controller.createAlert(PACIENTE);
      expect(service.createAlert).toHaveBeenCalledWith(PACIENTE);
    });

    it('listHistory no recibe filtros: es la vista completa del psicólogo', async () => {
      await controller.listHistory();
      expect(service.listHistory).toHaveBeenCalledWith();
    });

    it('getActiveAlert sirve tanto al paciente como al padrino', async () => {
      await controller.getActiveAlert(PADRINO);
      expect(service.getActiveAlert).toHaveBeenCalledWith(PADRINO);
    });

    it('getPendingAlerts consulta las del padrino, no las del paciente', async () => {
      await controller.getPendingAlerts(PADRINO);
      expect(service.getPendingAlerts).toHaveBeenCalledWith(PADRINO);
    });
  });

  describe('acciones sobre una alerta', () => {
    // El orden de los argumentos importa: respond recibe el padrino y cancel el
    // paciente. Invertirlos dejaría que cualquiera cerrara la alerta de otro.
    it('respond recibe el id de la alerta y el del padrino, en ese orden', async () => {
      await controller.respond(ALERTA, PADRINO);
      expect(service.respond).toHaveBeenCalledWith(ALERTA, PADRINO);
    });

    it('cancel recibe el id de la alerta y el del paciente', async () => {
      await controller.cancel(ALERTA, PACIENTE);
      expect(service.cancel).toHaveBeenCalledWith(ALERTA, PACIENTE);
    });

    it('cancelActive solo necesita el paciente', async () => {
      await controller.cancelActive(PACIENTE);
      expect(service.cancelActiveAlert).toHaveBeenCalledWith(PACIENTE);
    });

    it('escalate recibe el id de la alerta y el del paciente', async () => {
      await controller.escalate(ALERTA, PACIENTE);
      expect(service.escalate).toHaveBeenCalledWith(ALERTA, PACIENTE);
    });

    it('notifyCommunity recibe el id de la alerta y el del paciente', async () => {
      await controller.notifyCommunity(ALERTA, PACIENTE);
      expect(service.notifyCommunity).toHaveBeenCalledWith(ALERTA, PACIENTE);
    });
  });

  it('devuelve tal cual lo que responde el servicio, sin transformarlo', async () => {
    await expect(controller.notifyCommunity(ALERTA, PACIENTE)).resolves.toEqual({
      communityNotified: true,
    });
    await expect(controller.cancelActive(PACIENTE)).resolves.toEqual({ cancelled: true });
  });
});
