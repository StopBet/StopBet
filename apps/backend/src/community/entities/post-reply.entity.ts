import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { CommunityPost } from './community-post.entity';

@Entity('post_replies')
export class PostReply {
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

  @Column({ type: 'text' })
  body: string;

  // Ver el mismo campo en CommunityPost: evita que un reintento tras una respuesta
  // perdida deje la misma respuesta dos veces en el hilo.
  @Column({ type: 'varchar', length: 64, nullable: true, unique: true })
  clientRequestId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
