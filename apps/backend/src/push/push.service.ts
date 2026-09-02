import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { readFileSync } from 'node:fs';
import { App, cert, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { DeviceToken } from './entities/device-token.entity';

// Errores con los que FCM avisa que un token ya no sirve. Los tokens rotan solos
// cuando el usuario reinstala o limpia datos, así que sin esto la tabla se llena
// de destinatarios muertos y cada envío arrastra fallos que no significan nada.
const TOKENS_MUERTOS = [
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
];

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private app: App | null = null;

  constructor(
    @InjectRepository(DeviceToken)
    private readonly tokenRepo: Repository<DeviceToken>,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    const credenciales = this.leerCredenciales();
    if (!credenciales) {
      // Sin credenciales el resto del backend tiene que seguir funcionando: es lo
      // que permite levantarlo en local o en CI sin el service account.
      this.logger.warn(
        'Firebase sin configurar: las notificaciones push quedan desactivadas',
      );
      return;
    }
    try {
      this.app = initializeApp({ credential: cert(credenciales) }, 'push');
      this.logger.log('Firebase inicializado: notificaciones push activas');
    } catch (err) {
      this.logger.error(`No se pudo inicializar Firebase: ${(err as Error).message}`);
    }
  }

  // En Railway no se pueden subir archivos, así que producción entrega el JSON
  // completo por variable de entorno. En local se usa la ruta a un archivo.
  private leerCredenciales(): Record<string, string> | null {
    const inline = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');
    if (inline?.trim()) {
      try {
        return JSON.parse(inline) as Record<string, string>;
      } catch {
        this.logger.error('FIREBASE_SERVICE_ACCOUNT_JSON no es JSON válido');
        return null;
      }
    }

    const ruta = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH');
    if (!ruta?.trim()) return null;
    try {
      return JSON.parse(readFileSync(ruta, 'utf8')) as Record<string, string>;
    } catch {
      this.logger.error(`No se pudo leer el service account en ${ruta}`);
      return null;
    }
  }

  get activo(): boolean {
    return this.app !== null;
  }

  async registrarToken(
    userId: string,
    token: string,
    platform?: string,
  ): Promise<{ registrado: boolean }> {
    const existente = await this.tokenRepo.findOne({ where: { token } });

    // El mismo token puede pasar de un usuario a otro si dos personas usan el
    // mismo teléfono: se reasigna en vez de duplicar, para no mandarle a la
    // anterior notificaciones que ya no le corresponden.
    if (existente) {
      existente.userId = userId;
      existente.platform = platform ?? existente.platform;
      await this.tokenRepo.save(existente);
      return { registrado: true };
    }

    await this.tokenRepo.save(
      this.tokenRepo.create({ userId, token, platform: platform ?? null }),
    );
    return { registrado: true };
  }

  async olvidarToken(token: string): Promise<{ eliminado: boolean }> {
    const r = await this.tokenRepo.delete({ token });
    return { eliminado: (r.affected ?? 0) > 0 };
  }

  /** Envía a todos los dispositivos de esos usuarios. Devuelve cuántos llegaron. */
  async enviarAUsuarios(
    userIds: string[],
    title: string,
    body: string,
    canal: 'recordatorios' | 'panic_alerts' = 'recordatorios',
  ): Promise<number> {
    if (!this.app || userIds.length === 0) return 0;

    const registros = await this.tokenRepo.find({ where: { userId: In(userIds) } });
    if (registros.length === 0) return 0;

    const tokens = registros.map((r) => r.token);
    const respuesta = await getMessaging(this.app).sendEachForMulticast({
      tokens,
      notification: { title, body },
      // Sin canal explícito, Android entrega por `fcm_fallback_notification_channel`,
      // que tiene importancia media: la notificación queda en la barra y solo se ve
      // al desplegarla. La app ya crea `recordatorios` con importancia alta, que es
      // la que muestra el aviso flotante sobre la pantalla.
      android: {
        priority: 'high',
        notification: { channelId: canal },
      },
    });

    const invalidos = respuesta.responses.reduce<string[]>((acc, r, i) => {
      const code = r.error?.code;
      if (!r.success && code && TOKENS_MUERTOS.includes(code)) acc.push(tokens[i]);
      return acc;
    }, []);

    if (invalidos.length > 0) {
      await this.tokenRepo.delete({ token: In(invalidos) });
    }

    // Solo conteos: nunca identificadores de pacientes en los logs
    this.logger.log(
      `Push enviado: ${respuesta.successCount} de ${tokens.length}` +
        (invalidos.length ? ` · ${invalidos.length} tokens vencidos eliminados` : ''),
    );
    return respuesta.successCount;
  }
}
