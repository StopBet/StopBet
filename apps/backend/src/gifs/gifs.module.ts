import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockedGif } from './entities/blocked-gif.entity';
import { GifsController } from './gifs.controller';
import { GifsService } from './gifs.service';
import { GiphyClient } from './giphy.client';

@Module({
  imports: [TypeOrmModule.forFeature([BlockedGif])],
  controllers: [GifsController],
  providers: [GifsService, GiphyClient],
  exports: [GifsService],
})
export class GifsModule {}
