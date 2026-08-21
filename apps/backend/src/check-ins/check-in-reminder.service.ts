import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CheckIn } from './entities/check-in.entity';
import { User } from '../users/entities/user.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { todayInChile } from './chile-date';
import { PushService } from '../push/push.service';

// CA7.4: a las 20:00 hora de Chile se avisa a quien todavía no registró su ánimo.
// La zona horaria es explícita: el servidor puede correr en UTC (Railway) y un
// cron "a las 20:00" del servidor caería a las 16:00 del paciente.
const REMINDER_CRON = '0 20 * * *';
const CHILE_TZ = 'America/Santiago';

@Injectable()
export class CheckInReminderService {
  private readonly logger = new Logger(CheckInReminderService.name);

  constructor(
    @InjectRepository(CheckIn)
    private readonly checkInRepo: Repository<CheckIn>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    private readonly pushService: PushService,
  ) {}

  @Cron(REMINDER_CRON, { timeZone: CHILE_TZ })
  async remindPendingCheckIns(): Promise<number> {
    const today = todayInChile();

    const patients = await this.userRepo.find({
      where: { role: 'patient' },
      select: ['id'],
    });
    if (patients.length === 0) return 0;

    const done = await this.checkInRepo.find({
      where: { date: today },
      select: ['userId'],
    });
    const doneIds = new Set(done.map((c) => c.userId));
    const pending = patients.filter((p) => !doneIds.has(p.id));

    const TITULO = '¿Cómo estuvo tu día?';
    const CUERPO =
      'Todavía no registras cómo te sentiste hoy. Tómate un minuto para hacerlo.';

    if (pending.length > 0) {
      // La notificación en la tabla se guarda primero: es lo que ve el paciente al
      // abrir la app, y tiene que quedar registrada aunque el push no salga.
      await this.notificationRepo.save(
        pending.map((p) =>
          this.notificationRepo.create({
            userId: p.id,
            type: 'info',
            title: TITULO,
            body: CUERPO,
          }),
        ),
      );

      // CA7.4: el push es lo que llega sin abrir la app. Si falla no se propaga:
      // un problema de Firebase no puede tumbar el recordatorio ni el cron diario.
      try {
        await this.pushService.enviarAUsuarios(
          pending.map((p) => p.id),
          TITULO,
          CUERPO,
        );
      } catch (err) {
        this.logger.error(`No se pudo enviar el push: ${(err as Error).message}`);
      }
    }

    // Solo el conteo: nunca identificadores de pacientes en los logs
    this.logger.log(`Recordatorio de check-in enviado a ${pending.length} pacientes`);
    return pending.length;
  }
}
