import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sede } from './entities/sede.entity';

const SEED_SEDES = [
  { name: 'Santiago',      address: 'Av. Providencia 123',                         activeGroups: 12, type: 'presential' as const },
  { name: 'Viña del Mar',  address: 'Calle Valparaíso 456',                        activeGroups: 8,  type: 'presential' as const },
  { name: 'Concepción',    address: "Av. O'Higgins 789",                           activeGroups: 6,  type: 'presential' as const },
  { name: 'Online',        address: 'Sesiones virtuales desde cualquier lugar',    activeGroups: 4,  type: 'online'     as const },
];

@Injectable()
export class SedesService implements OnModuleInit {
  constructor(
    @InjectRepository(Sede)
    private readonly repo: Repository<Sede>,
  ) {}

  async onModuleInit() {
    const count = await this.repo.count();
    if (count === 0) {
      await this.repo.save(SEED_SEDES.map((s) => this.repo.create(s)));
    }
  }

  findAll(): Promise<Sede[]> {
    return this.repo.find({ where: { isActive: true } });
  }
}
