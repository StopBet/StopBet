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

  // CA5.3: motivo que indica el denunciante al reportar. Lleva default porque
  // los reportes anteriores a este criterio se registraron sin motivo.
  @Column({ type: 'text', default: 'Sin motivo indicado' })
  reason: string;

  // Moderación: el psicólogo revisó el reporte y dejó la publicación. No se borra el
  // reporte para que quede registro de quién decidió y cuándo. null = pendiente.
  @Column({ type: 'timestamp', nullable: true })
  dismissedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  dismissedBy: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
