import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { RegistrationStatus } from '@stopbet/shared-types';
import { User } from '../../users/entities/user.entity';

const STATUSES: RegistrationStatus[] = ['pending', 'approved', 'rejected'];

@Entity('registration_requests')
export class RegistrationRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  sedeId: string;

  @Column({ default: 'AJUTER' })
  institutionId: string;

  @Column({ type: 'enum', enum: STATUSES, default: 'pending' })
  status: RegistrationStatus;

  // UUID del psicólogo que revisó la solicitud
  @Column({ nullable: true })
  reviewedBy: string | null;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
