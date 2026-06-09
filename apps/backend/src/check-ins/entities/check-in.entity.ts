import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EmotionType } from '@stopbet/shared-types';
import { User } from '../../users/entities/user.entity';

const EMOTIONS: EmotionType[] = ['tired', 'anxious', 'angry', 'lonely', 'good'];

@Entity('check_ins')
export class CheckIn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'enum', enum: EMOTIONS })
  emotion: EmotionType;

  // Solo la fecha (YYYY-MM-DD) para forzar unicidad por día
  @Column({ type: 'date' })
  date: string;

  @CreateDateColumn()
  createdAt: Date;
}
