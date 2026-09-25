import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PanicAlert } from '../panic/entities/panic-alert.entity';
import { SponsorAssignment } from '../panic/entities/sponsor-assignment.entity';
import { CheckIn } from '../check-ins/entities/check-in.entity';
import { CommunityMute } from '../notifications/entities/community-mute.entity';
import { PostReport } from '../community/entities/post-report.entity';
import { CommunityPost } from '../community/entities/community-post.entity';
import { AbstinencePeriod } from '../achievements/entities/abstinence-period.entity';
import { EarnedBadge } from '../achievements/entities/earned-badge.entity';
import { DemoService } from './demo.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PanicAlert,
      SponsorAssignment,
      CheckIn,
      CommunityMute,
      PostReport,
      CommunityPost,
      AbstinencePeriod,
      EarnedBadge,
    ]),
  ],
  providers: [DemoService],
  exports: [DemoService],
})
export class DemoModule {}
