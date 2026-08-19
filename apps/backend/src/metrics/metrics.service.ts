import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { EMOTION_MOOD, PatientMetrics } from '@stopbet/shared-types';
import { CheckIn } from '../check-ins/entities/check-in.entity';
import { PanicAlert } from '../panic/entities/panic-alert.entity';

const WINDOW_DAYS = 30;

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

@Injectable()
export class MetricsService {
  constructor(
    @InjectRepository(CheckIn)
    private readonly checkInRepo: Repository<CheckIn>,
    @InjectRepository(PanicAlert)
    private readonly panicAlertRepo: Repository<PanicAlert>,
  ) {}

  async getPatientMetrics(patientId: string): Promise<PatientMetrics> {
    const since = daysAgo(WINDOW_DAYS);
    const sinceDateOnly = since.toISOString().split('T')[0];

    const checkIns = await this.checkInRepo.find({
      where: { userId: patientId, date: MoreThanOrEqual(sinceDateOnly) },
      order: { date: 'ASC' },
    });

    const panicCount = await this.panicAlertRepo.count({
      where: { patientId, createdAt: MoreThanOrEqual(since) },
    });

    const evolution = checkIns.map((c) => ({ date: c.date, mood: EMOTION_MOOD[c.emotion] }));
    const totalCheckIns = evolution.length;
    const moodAvg = totalCheckIns
      ? Math.round((evolution.reduce((sum, e) => sum + e.mood, 0) / totalCheckIns) * 10) / 10
      : null;

    return { evolution, totalCheckIns, panicCount, moodAvg };
  }
}