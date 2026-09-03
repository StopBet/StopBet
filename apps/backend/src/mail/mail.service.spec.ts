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
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    sendMail = jest.fn().mockResolvedValue({ messageId: 'x' });
    createTransportMock.mockReturnValue({ sendMail });
    fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 201 });
    global.fetch = fetchMock as unknown as typeof fetch;
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  describe('sin nada configurado', () => {
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

  describe('con Brevo configurado', () => {
    const config = {
      BREVO_API_KEY: 'xkeysib-abc123',
      MAIL_FROM: 'StopBet <no-reply@stopbet.cl>',
    };

    function servicio(extra: Record<string, string> = {}) {
      const s = new MailService(configWith({ ...config, ...extra }));
      s.onModuleInit();
      return s;
    }

    it('envía por HTTPS y no construye transporte SMTP', async () => {
      const s = servicio();

      await expect(s.send(message)).resolves.toBe(true);
      expect(createTransportMock).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.brevo.com/v3/smtp/email');
      expect(init.headers['api-key']).toBe('xkeysib-abc123');
    });

    // Brevo no acepta el remitente como una sola cadena al estilo de Nodemailer: exige el
    // nombre y la dirección en campos separados.
    it('parte MAIL_FROM en nombre y dirección', async () => {
      await servicio().send(message);

      const cuerpo = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(cuerpo.sender).toEqual({ name: 'StopBet', email: 'no-reply@stopbet.cl' });
      expect(cuerpo.to).toEqual([{ email: message.to }]);
      expect(cuerpo.textContent).toBe(message.text);
      expect(cuerpo.htmlContent).toBe(message.html);
    });

    it('acepta un MAIL_FROM que sea solo la dirección', async () => {
      await servicio({ MAIL_FROM: 'no-reply@stopbet.cl' }).send(message);

      const cuerpo = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(cuerpo.sender.email).toBe('no-reply@stopbet.cl');
    });

    // Railway bloquea los puertos SMTP en el plan del proyecto, así que si están las dos
    // configuraciones gana la que de verdad puede entregar.
    it('tiene prioridad sobre SMTP cuando están ambas', async () => {
      const s = servicio({ SMTP_HOST: 'smtp.gmail.com', SMTP_PORT: '587' });

      await s.send(message);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(sendMail).not.toHaveBeenCalled();
    });

    it('devuelve false y no lanza si Brevo rechaza el envío', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => '{"message":"sender not valid"}',
      });

      await expect(servicio().send(message)).resolves.toBe(false);
    });

    // El 400 pelado no dice nada; el motivo real viene en el cuerpo de la respuesta.
    it('registra el motivo que devuelve Brevo, no solo el código', async () => {
      const error = jest.spyOn(Logger.prototype, 'error');
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => '{"message":"Key not found"}',
      });

      await servicio().send(message);

      const escrito = error.mock.calls.flat().join(' ');
      expect(escrito).toContain('401');
      expect(escrito).toContain('Key not found');
      expect(escrito).not.toContain(message.to);
    });

    it('devuelve false si la red falla', async () => {
      fetchMock.mockRejectedValue(new Error('fetch failed'));
      await expect(servicio().send(message)).resolves.toBe(false);
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
