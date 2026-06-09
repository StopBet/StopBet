import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TechniqueType } from '@stopbet/shared-types';
import { AiSession } from './ai-session.entity';

const TECHNIQUE_TYPES: TechniqueType[] = ['breathing', 'grounding', 'postponement'];

@Entity('ai_messages')
export class AiMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sessionId: string;

  @ManyToOne(() => AiSession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sessionId' })
  session: AiSession;

  @Column({ type: 'enum', enum: ['user', 'assistant'] })
  role: 'user' | 'assistant';

  // Contenido del mensaje — sensible, cifrar en reposo en producción
  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'enum', enum: TECHNIQUE_TYPES, nullable: true })
  techniqueTriggered: TechniqueType | null;

  @CreateDateColumn()
  createdAt: Date;
}
