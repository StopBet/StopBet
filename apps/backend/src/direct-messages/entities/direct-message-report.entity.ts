import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DirectMessage } from './direct-message.entity';

/**
 * Un mensaje directo reportado. Es lo **único** de una conversación privada que llega a ver el
 * equipo clínico: el mensaje, no la conversación.
 */
@Entity('direct_message_reports')
@Index(['messageId', 'reporterId'], { unique: true })
export class DirectMessageReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  messageId: string;

  @ManyToOne(() => DirectMessage, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'messageId' })
  message: DirectMessage;

  @Column()
  reporterId: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'timestamptz', nullable: true })
  dismissedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  dismissedBy: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
