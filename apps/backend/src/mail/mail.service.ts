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

// Un servidor SMTP que no responde no puede dejar colgada la creación de una cuenta: el
// correo es un extra sobre una operación que en la BD ya se completó.
const TIMEOUT_MS = 10_000;

const DEFAULT_WEB_APP_URL = 'https://stopbet-lemon.vercel.app';

// Los correos no se loguean enteros: la regla del proyecto prohíbe datos identificables en
// los logs del servidor, y para depurar un envío alcanza con reconocer de cuál se trata.
function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return '***';
  return `${user.slice(0, 2)}${'*'.repeat(Math.max(user.length - 2, 1))}@${domain}`;
}

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private from = '';

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const host = this.configService.get<string>('SMTP_HOST')?.trim();
    if (!host) {
      // Mismo criterio que Firebase en PushService: sin credenciales el backend arranca
      // igual y solo se apaga esta función. En HdU24 el respaldo es que el coordinador
      // sigue viendo la contraseña temporal en pantalla para entregarla a mano.
      this.logger.warn('SMTP sin configurar: el envío de correos queda desactivado');
      return;
    }

    const port = Number(this.configService.get<string>('SMTP_PORT') ?? 587);
    const user = this.configService.get<string>('SMTP_USER')?.trim();
    const pass = this.configService.get<string>('SMTP_PASSWORD')?.trim();

    this.from = this.configService.get<string>('MAIL_FROM')?.trim() || `StopBet <no-reply@${host}>`;

    this.transporter = createTransport({
      host,
      port,
      // 465 es TLS implícito; 587 abre en claro y sube a TLS con STARTTLS.
      secure: port === 465,
      // Un relay local de pruebas (Mailpit, MailHog) no pide credenciales.
      auth: user && pass ? { user, pass } : undefined,
      connectionTimeout: TIMEOUT_MS,
      greetingTimeout: TIMEOUT_MS,
      socketTimeout: TIMEOUT_MS,
    });

    this.logger.log(`SMTP configurado en ${host}:${port}: envío de correos activo`);
  }

  get isEnabled(): boolean {
    return this.transporter !== null;
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
    if (!this.transporter) return false;

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      this.logger.log(`Correo enviado a ${maskEmail(message.to)}`);
      return true;
    } catch (err) {
      // Nivel `error` a propósito: un SMTP mal configurado falla en *todos* los envíos, y
      // sin ruido nadie se entera hasta que alguien reclama que nunca le llegó nada.
      this.logger.error(
        `No se pudo enviar el correo a ${maskEmail(message.to)}: ${(err as Error).message}`,
      );
      return false;
    }
  }
}
