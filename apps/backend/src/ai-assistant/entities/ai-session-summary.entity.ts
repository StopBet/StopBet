import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { RiskLevel } from '@stopbet/shared-types';
import { AiSession } from './ai-session.entity';

const RISK_LEVELS: RiskLevel[] = ['low', 'medium', 'high'];

@Entity('ai_session_summaries')
export class AiSessionSummary {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sessionId: string;

  @OneToOne(() => AiSession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sessionId' })
  session: AiSession;

  @Column()
  userId: string;

  @Column({ nullable: true })
  mood: string | null;

  @Column({ nullable: true })
  techniqueUsed: string | null;

  @Column({ nullable: true })
  trigger: string | null;

  // Sin default: omitir el campo tiene que quedar como "sin evaluar", no como
  // "sin riesgo". El default 'low' hacía que el esquema mintiera por omisión.
  @Column({ type: 'enum', enum: RISK_LEVELS, nullable: true })
  riskLevel: RiskLevel | null;

  @Column({ type: 'int', default: 0 })
  durationMinutes: number;

  @Column({ nullable: true })
  progressNote: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
