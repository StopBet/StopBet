import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { ReactionEmoji } from '@stopbet/shared-types';
import { User } from '../../users/entities/user.entity';
import { CommunityPost } from './community-post.entity';

const EMOJIS: ReactionEmoji[] = ['💪', '❤️', '🤗'];

@Unique(['postId', 'authorId', 'emoji'])
@Entity('post_reactions')
export class PostReaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  postId: string;

  @ManyToOne(() => CommunityPost, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'postId' })
  post: CommunityPost;

  @Column()
  authorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'authorId' })
  author: User;

  @Column({ type: 'enum', enum: EMOJIS })
  emoji: ReactionEmoji;

  @CreateDateColumn()
  createdAt: Date;
}
