import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import { MailService } from './mail.service';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

const createTransportMock = createTransport as unknown as jest.Mock;

function configWith(values: Record<string, string>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

const message = {
  to: 'fernanda.fuentes@ajuter.cl',
  subject: 'Asunto',
  text: 'cuerpo',
  html: '<p>cuerpo</p>',
};

describe('MailService', () => {
  let sendMail: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    sendMail = jest.fn().mockResolvedValue({ messageId: 'x' });
    createTransportMock.mockReturnValue({ sendMail });
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  describe('sin SMTP configurado', () => {
    it('arranca igual y deja el envío desactivado, sin construir transporte', () => {
      const service = new MailService(configWith({}));
      service.onModuleInit();

      expect(service.isEnabled).toBe(false);
      expect(createTransportMock).not.toHaveBeenCalled();
    });

    // El backend tiene que poder levantarse en local y en CI sin credenciales de correo:
    // quien llame a send() recibe `false`, no una excepción que tumbe la petición.
    it('send() devuelve false en vez de lanzar', async () => {
      const service = new MailService(configWith({}));
      service.onModuleInit();

      await expect(service.send(message)).resolves.toBe(false);
      expect(sendMail).not.toHaveBeenCalled();
    });
  });

  describe('con SMTP configurado', () => {
    const config = {
      SMTP_HOST: 'smtp.proveedor.com',
      SMTP_PORT: '587',
      SMTP_USER: 'usuario',
      SMTP_PASSWORD: 'clave',
      MAIL_FROM: 'StopBet <no-reply@stopbet.cl>',
    };

    it('envía el correo con el remitente configurado y devuelve true', async () => {
      const service = new MailService(configWith(config));
      service.onModuleInit();

      await expect(service.send(message)).resolves.toBe(true);
      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'StopBet <no-reply@stopbet.cl>',
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
        }),
      );
    });

    // 465 es TLS implícito y 587 sube a TLS con STARTTLS: invertirlo deja la conexión
    // colgada en el saludo, que es un fallo mudo y difícil de rastrear.
    it('usa TLS implícito solo en el puerto 465', () => {
      new MailService(configWith({ ...config, SMTP_PORT: '465' })).onModuleInit();
      expect(createTransportMock).toHaveBeenCalledWith(expect.objectContaining({ secure: true }));

      createTransportMock.mockClear();
      new MailService(configWith(config)).onModuleInit();
      expect(createTransportMock).toHaveBeenCalledWith(expect.objectContaining({ secure: false }));
    });

    it('omite la autenticación cuando el relay no pide credenciales', () => {
      new MailService(configWith({ SMTP_HOST: 'localhost', SMTP_PORT: '1025' })).onModuleInit();
      expect(createTransportMock).toHaveBeenCalledWith(expect.objectContaining({ auth: undefined }));
    });

    it('devuelve false y no lanza si el servidor rechaza el envío', async () => {
      sendMail.mockRejectedValue(new Error('535 authentication failed'));
      const service = new MailService(configWith(config));
      service.onModuleInit();

      await expect(service.send(message)).resolves.toBe(false);
    });

    // La regla del proyecto prohíbe datos identificables en los logs del servidor.
    it('nunca escribe la dirección completa en el log', async () => {
      const log = jest.spyOn(Logger.prototype, 'log');
      const service = new MailService(configWith(config));
      service.onModuleInit();
      await service.send(message);

      const escrito = log.mock.calls.flat().join(' ');
      expect(escrito).not.toContain(message.to);
      expect(escrito).toContain('@ajuter.cl');
    });
  });

  describe('webAppUrl', () => {
    it('usa WEB_APP_URL cuando está definida', () => {
      const service = new MailService(configWith({ WEB_APP_URL: 'https://panel.stopbet.cl' }));
      expect(service.webAppUrl).toBe('https://panel.stopbet.cl');
    });

    it('cae al dominio público del dashboard si no está definida', () => {
      const service = new MailService(configWith({}));
      expect(service.webAppUrl).toMatch(/^https:\/\//);
    });
  });
});
