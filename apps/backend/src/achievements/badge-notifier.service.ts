import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AbstinencePeriod } from './entities/abstinence-period.entity';
import { AchievementsService } from './achievements.service';

// HDU3 CA1: la insignia tiene que avisar "incluso si la aplicación está cerrada", y los
// hitos cambian a medianoche, cuando nadie tiene la app abierta. Sin esta pasada el
// otorgamiento solo ocurre cuando el paciente entra a Logros: la notificación llegaría
// recién cuando ya está mirando la pantalla que iba a avisarle.
//
// A las 09:00 y no a las 00:00 por dos razones: es una hora en que el aviso se lee en vez
// de quedar sepultado entre las notificaciones de la noche, y deja lejos el recordatorio
// de check-in de las 20:00 para que no se pisen.
const BADGE_CRON = '0 9 * * *';

// Explícita: el servidor corre en UTC (Railway) y un cron "a las 09:00" del servidor
// caería a las 05:00 o 06:00 del paciente, según el horario de verano.
const CHILE_TZ = 'America/Santiago';

@Injectable()
export class BadgeNotifierService {
  private readonly logger = new Logger(BadgeNotifierService.name);

  constructor(
    @InjectRepository(AbstinencePeriod)
    private readonly periodRepo: Repository<AbstinencePeriod>,
    private readonly achievementsService: AchievementsService,
  ) {}

  @Cron(BADGE_CRON, { timeZone: CHILE_TZ })
  async otorgarInsigniasDelDia(): Promise<number> {
    const abiertos = await this.periodRepo.find({
      where: { endDate: IsNull() },
      relations: ['earnedBadges'],
    });

    let otorgadas = 0;
    for (const period of abiertos) {
      // Aislado por paciente: un período con datos rotos no puede dejar sin su
      // insignia a todos los que vienen después en la lista.
      try {
        const nuevas = await this.achievementsService.otorgarInsigniasDelPeriodo(period);
        otorgadas += nuevas.length;
      } catch (err) {
        this.logger.error(`Falló la evaluación de un período: ${(err as Error).message}`);
      }
    }

    // Solo conteos: nunca identificadores de pacientes en los logs
    this.logger.log(
      `Pasada diaria de insignias: ${otorgadas} otorgadas sobre ${abiertos.length} períodos abiertos`,
    );
    return otorgadas;
  }
}
