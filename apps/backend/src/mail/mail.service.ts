import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  /** Alternativa en texto plano. Obligatoria: un correo solo-HTML puntúa peor en los filtros de spam. */
  text: string;
  html: string;
}

// Ni un SMTP que no responde ni una API lenta pueden dejar colgada la creación de una
// cuenta: el correo es un extra sobre una operación que en la BD ya se completó.
const TIMEOUT_MS = 10_000;

const DEFAULT_WEB_APP_URL = 'https://stopbet-lemon.vercel.app';
const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

// Dos formas de entregar el correo. Brevo va por HTTPS y SMTP por el puerto 587.
type Transport =
  | { kind: 'brevo'; apiKey: string }
  | { kind: 'smtp'; transporter: Transporter };

// Los correos no se loguean enteros: la regla del proyecto prohíbe datos identificables en
// los logs del servidor, y para depurar un envío alcanza con reconocer de cuál se trata.
function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return '***';
  return `${user.slice(0, 2)}${'*'.repeat(Math.max(user.length - 2, 1))}@${domain}`;
}

// Nodemailer acepta `MAIL_FROM` como una sola cadena ("StopBet <no-reply@x.cl>"); la API de
// Brevo exige el nombre y la dirección separados, así que hay que partirla.
function parseFrom(raw: string): { name: string; email: string } {
  const conNombre = raw.match(/^\s*(.*?)\s*<\s*([^>]+?)\s*>\s*$/);
  if (conNombre) return { name: conNombre[1] || 'StopBet', email: conNombre[2] };
  return { name: 'StopBet', email: raw.trim() };
}

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transport: Transport | null = null;
  private from = '';

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const brevoKey = this.configService.get<string>('BREVO_API_KEY')?.trim();
    const host = this.configService.get<string>('SMTP_HOST')?.trim();

    this.from =
      this.configService.get<string>('MAIL_FROM')?.trim() ||
      `StopBet <no-reply@${host || 'stopbet.cl'}>`;

    // Brevo tiene prioridad sobre SMTP cuando están las dos, porque es la que funciona en
    // producción: Railway bloquea los puertos SMTP salientes en los planes Free, Trial y
    // Hobby, y este proyecto corre en Hobby. Ver docs/avisos-al-equipo.md.
    if (brevoKey) {
      this.transport = { kind: 'brevo', apiKey: brevoKey };
      this.logger.log('Brevo configurado: envío de correos activo por HTTPS');
      return;
    }

    if (!host) {
      // Mismo criterio que Firebase en PushService: sin credenciales el backend arranca
      // igual y solo se apaga esta función. En HdU24 el respaldo es que el coordinador
      // sigue viendo la contraseña temporal en pantalla para entregarla a mano.
      this.logger.warn('Correo sin configurar: el envío queda desactivado');
      return;
    }

    const port = Number(this.configService.get<string>('SMTP_PORT') ?? 587);
    const user = this.configService.get<string>('SMTP_USER')?.trim();
    const pass = this.configService.get<string>('SMTP_PASSWORD')?.trim();

    this.transport = {
      kind: 'smtp',
      transporter: createTransport({
        host,
        port,
        // 465 es TLS implícito; 587 abre en claro y sube a TLS con STARTTLS.
        secure: port === 465,
        // Un relay local de pruebas (Mailpit, MailHog) no pide credenciales.
        auth: user && pass ? { user, pass } : undefined,
        connectionTimeout: TIMEOUT_MS,
        greetingTimeout: TIMEOUT_MS,
        socketTimeout: TIMEOUT_MS,
      }),
    };

    this.logger.log(`SMTP configurado en ${host}:${port}: envío de correos activo`);
  }

  get isEnabled(): boolean {
    return this.transport !== null;
  }

  /**
   * URL pública del dashboard, para los enlaces que van dentro de los correos. Vive acá
   * porque hoy los correos son lo único que necesita enlazar de vuelta a la web.
   */
  get webAppUrl(): string {
    return this.configService.get<string>('WEB_APP_URL')?.trim() || DEFAULT_WEB_APP_URL;
  }

  /**
   * Devuelve si el correo salió. Nunca lanza: quien la llama ya completó una operación que
   * no debe deshacerse porque el servidor de correo esté caído.
   */
  async send(message: MailMessage): Promise<boolean> {
    if (!this.transport) return false;

    try {
      if (this.transport.kind === 'brevo') {
        await this.sendViaBrevo(this.transport.apiKey, message);
      } else {
        await this.transport.transporter.sendMail({
          from: this.from,
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
        });
      }
      this.logger.log(`Correo enviado a ${maskEmail(message.to)}`);
      return true;
    } catch (err) {
      // Nivel `error` a propósito: un correo mal configurado falla en *todos* los envíos, y
      // sin ruido nadie se entera hasta que alguien reclama que nunca le llegó nada.
      this.logger.error(
        `No se pudo enviar el correo a ${maskEmail(message.to)}: ${(err as Error).message}`,
      );
      return false;
    }
  }

  private async sendViaBrevo(apiKey: string, message: MailMessage): Promise<void> {
    const sender = parseFrom(this.from);

    const res = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender,
        to: [{ email: message.to }],
        subject: message.subject,
        textContent: message.text,
        htmlContent: message.html,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      // El cuerpo trae el motivo real ("sender not valid", clave revocada, cuota agotada).
      // Sin él, en el log solo quedaría un 400 pelado y habría que adivinar.
      const detalle = await res.text().catch(() => '');
      throw new Error(`Brevo respondió ${res.status}${detalle ? `: ${detalle.slice(0, 200)}` : ''}`);
    }
  }
}
