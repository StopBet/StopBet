import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sede } from './entities/sede.entity';
import { SedesController } from './sedes.controller';
import { SedesService } from './sedes.service';

@Module({
  imports: [TypeOrmModule.forFeature([Sede])],
  controllers: [SedesController],
  providers: [SedesService],
  exports: [SedesService],
})
export class SedesModule {}
