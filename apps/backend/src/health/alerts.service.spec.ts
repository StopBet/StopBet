import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { AlertsService } from './alerts.service';

describe('AlertsService', () => {
  let service: AlertsService;
  let dataSource: { query: jest.Mock };
  let config: { get: jest.Mock };
  let fetchMock: jest.Mock;

  beforeEach(() => {
    dataSource = { query: jest.fn() };
    config = { get: jest.fn() };
    fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;

    service = new AlertsService(
      config as unknown as ConfigService,
      dataSource as unknown as DataSource,
    );
  });

  describe('pingDatabase', () => {
    it('devuelve true cuando la query responde', async () => {
      dataSource.query.mockResolvedValue([{ '?column?': 1 }]);
      expect(await service.pingDatabase()).toBe(true);
    });

    it('devuelve false cuando la query falla, sin lanzar', async () => {
      dataSource.query.mockRejectedValue(new Error('conexión rechazada'));
      expect(await service.pingDatabase()).toBe(false);
    });
  });

  describe('notify', () => {
    it('solo loguea y no llama a fetch si no hay DISCORD_ALERT_WEBHOOK_URL (S.7)', async () => {
      config.get.mockReturnValue(undefined);
      await service.notify('mensaje de prueba');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('postea al webhook cuando la URL está configurada', async () => {
      config.get.mockReturnValue('https://discord.com/api/webhooks/fake');
      await service.notify('🔴 caída detectada');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/fake',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ content: '🔴 caída detectada' }),
        }),
      );
    });

    it('no lanza si el webhook falla — solo debe loguear', async () => {
      config.get.mockReturnValue('https://discord.com/api/webhooks/fake');
      fetchMock.mockRejectedValue(new Error('network error'));
      await expect(service.notify('mensaje')).resolves.not.toThrow();
    });
  });

  describe('checkDatabaseHealth — transición de estado', () => {
    it('alerta solo en la transición arriba→abajo, no en cada tick caído', async () => {
      config.get.mockReturnValue('https://discord.com/api/webhooks/fake');
      dataSource.query.mockRejectedValue(new Error('caída'));

      await service.checkDatabaseHealth(); // primera caída → alerta
      await service.checkDatabaseHealth(); // sigue caída → sin alerta nueva
      await service.checkDatabaseHealth(); // sigue caída → sin alerta nueva

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('alerta de recuperación en la transición abajo→arriba', async () => {
      config.get.mockReturnValue('https://discord.com/api/webhooks/fake');
      dataSource.query.mockRejectedValue(new Error('caída'));
      await service.checkDatabaseHealth(); // caída → 1 alerta

      dataSource.query.mockResolvedValue([{ '?column?': 1 }]);
      await service.checkDatabaseHealth(); // recupera → 1 alerta más

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[1][1].body).toContain('volvió a responder');
    });

    it('no alerta mientras todo sigue funcionando normalmente', async () => {
      config.get.mockReturnValue('https://discord.com/api/webhooks/fake');
      dataSource.query.mockResolvedValue([{ '?column?': 1 }]);

      await service.checkDatabaseHealth();
      await service.checkDatabaseHealth();

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
