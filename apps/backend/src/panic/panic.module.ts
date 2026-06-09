import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PanicController } from './panic.controller';
import { PanicService } from './panic.service';
import { SponsorAssignment } from './entities/sponsor-assignment.entity';
import { PanicAlert } from './entities/panic-alert.entity';
import { User } from '../users/entities/user.entity';
import { CommunityPost } from '../community/entities/community-post.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([SponsorAssignment, PanicAlert, User, CommunityPost]),
  ],
  controllers: [PanicController],
  providers: [PanicService],
})
export class PanicModule {}
