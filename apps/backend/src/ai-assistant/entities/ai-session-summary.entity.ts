import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PatientFeedback, RiskLevel, TechniqueType, TriggerCategory } from '@stopbet/shared-types';
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

  // HdU10: todas nullable, para que los resúmenes anteriores sigan siendo válidos.
  @Column({ type: 'varchar', nullable: true })
  triggerCategory: TriggerCategory | null;

  @Column({ type: 'varchar', nullable: true })
  technique: TechniqueType | null;

  @Column({ type: 'varchar', nullable: true })
  patientFeedback: PatientFeedback | null;

  @Column({ type: 'boolean', nullable: true })
  llmThoughtHelpful: boolean | null;

  @CreateDateColumn()
  createdAt: Date;
}
