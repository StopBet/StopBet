import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AISessionStatus } from '@stopbet/shared-types';
import { User } from '../../users/entities/user.entity';

const SESSION_STATUSES: AISessionStatus[] = ['active', 'closed'];

@Entity('ai_sessions')
export class AiSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'enum', enum: SESSION_STATUSES, default: 'active' })
  status: AISessionStatus;

  // Resumen breve de la sesión anterior — solo datos generales, sin contenido sensible
  @Column({ type: 'text', nullable: true })
  previousContext: string | null;

  @Column({ type: 'timestamp', nullable: true })
  closedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  lastActivityAt: Date | null;

  @CreateDateColumn()
  startedAt: Date;
}
