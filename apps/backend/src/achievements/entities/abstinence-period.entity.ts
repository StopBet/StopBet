import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { EarnedBadge } from './earned-badge.entity';

@Entity('abstinence_periods')
export class AbstinencePeriod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date', nullable: true })
  endDate: string | null;

  @Column({ type: 'int' })
  attemptNumber: number;

  @OneToMany(() => EarnedBadge, (badge) => badge.period, { eager: false })
  earnedBadges: EarnedBadge[];

  @CreateDateColumn()
  createdAt: Date;
}
