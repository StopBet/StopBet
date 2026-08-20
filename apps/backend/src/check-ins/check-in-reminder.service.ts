import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CheckIn } from './entities/check-in.entity';
import { User } from '../users/entities/user.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { todayInChile } from './chile-date';

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

    if (pending.length > 0) {
      await this.notificationRepo.save(
        pending.map((p) =>
          this.notificationRepo.create({
            userId: p.id,
            type: 'info',
            title: '¿Cómo estuvo tu día?',
            body: 'Todavía no registras cómo te sentiste hoy. Tómate un minuto para hacerlo.',
          }),
        ),
      );
    }

    // Solo el conteo: nunca identificadores de pacientes en los logs
    this.logger.log(`Recordatorio de check-in enviado a ${pending.length} pacientes`);
    return pending.length;
  }
}
