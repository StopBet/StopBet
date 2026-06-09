import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PaymentMethod, SubscriptionStatus } from '@stopbet/shared-types';
import { User } from '../../users/entities/user.entity';

const PAYMENT_METHODS: PaymentMethod[] = ['card', 'webpay', 'transfer'];
const STATUSES: SubscriptionStatus[] = ['pending', 'active', 'cancelled'];

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ default: 'AJUTER_MENSUAL' })
  plan: string;

  @Column({ type: 'int', default: 30000 })
  amountCLP: number;

  @Column({ type: 'enum', enum: PAYMENT_METHODS })
  paymentMethod: PaymentMethod;

  @Column({ type: 'enum', enum: STATUSES, default: 'pending' })
  status: SubscriptionStatus;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
