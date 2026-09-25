import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { NotificationTarget, NotificationType } from '@stopbet/shared-types';
import { User } from '../../users/entities/user.entity';

const NOTIFICATION_TYPES: NotificationType[] = [
  'warning',
  'info',
  'success',
  'danger',
];

const NOTIFICATION_TARGETS: NotificationTarget[] = [
  'check-in',
  'community',
  'achievements',
  'panic',
  'payment',
];

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'enum', enum: NOTIFICATION_TYPES })
  type: NotificationType;

  @Column()
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ default: false })
  read: boolean;

  // Nulo a propósito: las notificaciones anteriores a esta columna, y las que no llevan a
  // ninguna pantalla, solo se marcan leídas.
  @Column({ type: 'enum', enum: NOTIFICATION_TARGETS, nullable: true })
  target: NotificationTarget | null;

  @CreateDateColumn()
  createdAt: Date;
}
