import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';
import { CommunityPost } from './entities/community-post.entity';
import { PostReply } from './entities/post-reply.entity';
import { PostReaction } from './entities/post-reaction.entity';
import { PostReport } from './entities/post-report.entity';
import { AttendanceConfirmation } from './entities/attendance-confirmation.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CommunityPost,
      PostReply,
      PostReaction,
      PostReport,
      AttendanceConfirmation,
      User,
    ]),
  ],
  controllers: [CommunityController],
  providers: [CommunityService],
})
export class CommunityModule {}
