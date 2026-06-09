import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PanicAlertStatus } from '@stopbet/shared-types';
import { User } from '../../users/entities/user.entity';

const STATUSES: PanicAlertStatus[] = ['pending', 'responded', 'escalated', 'cancelled'];

@Entity('panic_alerts')
export class PanicAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  patientId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patientId' })
  patient: User;

  // Denormalizado en el momento del disparo para preservar la historia
  @Column()
  sponsorId: string;

  @Column({ type: 'enum', enum: STATUSES, default: 'pending' })
  status: PanicAlertStatus;

  @Column({ default: false })
  communityNotified: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  respondedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  escalatedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
