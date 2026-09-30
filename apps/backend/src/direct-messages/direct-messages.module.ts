import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Sede } from '../sedes/entities/sede.entity';
import { PsychologistSede } from '../psychologists/entities/psychologist-sede.entity';
import { PushModule } from '../push/push.module';
import { DirectMessagesController } from './direct-messages.controller';
import { DirectMessagesService } from './direct-messages.service';
import { DirectConversation } from './entities/direct-conversation.entity';
import { DirectMessage } from './entities/direct-message.entity';
import { DirectMessageReport } from './entities/direct-message-report.entity';
import { UserBlock } from './entities/user-block.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DirectConversation,
      DirectMessage,
      DirectMessageReport,
      UserBlock,
      User,
      Sede,
      PsychologistSede,
    ]),
    PushModule,
  ],
  controllers: [DirectMessagesController],
  providers: [DirectMessagesService],
  exports: [DirectMessagesService],
})
export class DirectMessagesModule {}
