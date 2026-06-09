import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { InvoiceStatus } from '@stopbet/shared-types';
import { User } from '../../users/entities/user.entity';

const INVOICE_STATUSES: InvoiceStatus[] = ['pending', 'paid', 'overdue'];

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  // Período de facturación: 'YYYY-MM'
  @Column({ length: 7 })
  month: string;

  @Column({ type: 'int', default: 30000 })
  amountCLP: number;

  @Column({ type: 'enum', enum: INVOICE_STATUSES, default: 'pending' })
  status: InvoiceStatus;

  @Column({ type: 'date' })
  dueDate: string;

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
