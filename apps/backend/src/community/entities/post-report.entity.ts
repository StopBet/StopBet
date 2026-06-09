import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { CommunityPost } from './community-post.entity';

@Unique(['postId', 'reporterId'])
@Entity('post_reports')
export class PostReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  postId: string;

  @ManyToOne(() => CommunityPost, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'postId' })
  post: CommunityPost;

  @Column()
  reporterId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporterId' })
  reporter: User;

  @CreateDateColumn()
  createdAt: Date;
}
