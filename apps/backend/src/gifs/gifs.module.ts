import { Module } from '@nestjs/common';
import { GifsController } from './gifs.controller';
import { GifsService } from './gifs.service';
import { GiphyClient } from './giphy.client';

@Module({
  controllers: [GifsController],
  providers: [GifsService, GiphyClient],
  exports: [GifsService],
})
export class GifsModule {}
