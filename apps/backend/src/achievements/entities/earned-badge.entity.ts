import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { AbstinencePeriod } from './abstinence-period.entity';

@Entity('earned_badges')
export class EarnedBadge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  periodId: string;

  @ManyToOne(() => AbstinencePeriod, (period) => period.earnedBadges, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'periodId' })
  period: AbstinencePeriod;

  // Días del hito: 1 | 3 | 7 | 14 | 21 | 30 | 45 | 60 | 75 | 90
  @Column({ type: 'int' })
  milestone: number;

  @Column({ type: 'date' })
  earnedAt: string;

  @Column({ type: 'boolean', default: false })
  sharedToCommunity: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
