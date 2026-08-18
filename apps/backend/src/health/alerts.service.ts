import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

// Vigila la conexión a BD y avisa al canal del equipo cuando cambia de estado.
// Cubre el caso "proceso vivo, BD caída" — no una caída total del proceso
// (que no puede alertar de su propia muerte; para eso hace falta un monitor externo
// apuntando a GET /health, documentado en el PR).
//
// Sin DISCORD_ALERT_WEBHOOK_URL configurada, solo loguea — mismo patrón que
// GEMINI_API_KEY: opcional, sin código muerto. El equipo agrega la URL cuando
// tenga el canal de Discord listo.
@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);
  private wasDown = false;

  constructor(
    private readonly config: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  @Cron('*/2 * * * *') // cada 2 minutos
  async checkDatabaseHealth(): Promise<void> {
    const isUp = await this.pingDatabase();

    if (!isUp && !this.wasDown) {
      this.wasDown = true;
      await this.notify('🔴 StopBet backend: la base de datos no responde.');
    } else if (isUp && this.wasDown) {
      this.wasDown = false;
      await this.notify('✅ StopBet backend: la base de datos volvió a responder.');
    }
  }

  async pingDatabase(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async notify(message: string): Promise<void> {
    const webhookUrl = this.config.get<string>('DISCORD_ALERT_WEBHOOK_URL');
    if (!webhookUrl) {
      this.logger.warn(`Alerta no enviada (DISCORD_ALERT_WEBHOOK_URL no configurada): ${message}`);
      return;
    }

    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message }),
      });
    } catch (err) {
      this.logger.error(`Fallo al enviar alerta a Discord: ${(err as Error).message}`);
    }
  }
}
