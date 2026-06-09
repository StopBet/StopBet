import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CommunityPostType } from '@stopbet/shared-types';
import { User } from '../../users/entities/user.entity';

const POST_TYPES: CommunityPostType[] = ['announcement', 'forum_post'];

@Entity('community_posts')
export class CommunityPost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  authorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'authorId' })
  author: User;

  @Column({ type: 'enum', enum: POST_TYPES })
  type: CommunityPostType;

  @Column()
  sede: string;

  @Column({ nullable: true })
  title: string | null;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'timestamptz', nullable: true })
  eventDate: Date | null;

  @Column({ type: 'int', default: 0 })
  reportCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
