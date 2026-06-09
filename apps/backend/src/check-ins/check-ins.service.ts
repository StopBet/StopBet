import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CheckIn } from './entities/check-in.entity';
import { CreateCheckInDto } from './dto/create-check-in.dto';

@Injectable()
export class CheckInsService {
  constructor(
    @InjectRepository(CheckIn)
    private readonly repo: Repository<CheckIn>,
  ) {}

  async getToday(userId: string): Promise<CheckIn | null> {
    const today = new Date().toISOString().split('T')[0];
    return this.repo.findOne({ where: { userId, date: today } });
  }

  async create(userId: string, dto: CreateCheckInDto): Promise<CheckIn> {
    const today = new Date().toISOString().split('T')[0];
    const existing = await this.getToday(userId);
    if (existing) {
      throw new ConflictException('El check-in de hoy ya fue registrado');
    }
    const checkIn = this.repo.create({ userId, emotion: dto.emotion, date: today });
    return this.repo.save(checkIn);
  }
}
