import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AccountStatus, OnboardingStatus, UserRole } from '@stopbet/shared-types';

const ROLES: UserRole[] = ['patient', 'psychologist', 'sponsor', 'family'];
const ONBOARDING_STATUSES: OnboardingStatus[] = [
  'approval_pending',
  'payment_pending',
  'complete',
];
const ACCOUNT_STATUSES: AccountStatus[] = ['active', 'suspended'];

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  // Nullable hasta que el paciente configure su contraseña tras la aprobación
  @Column({ nullable: true })
  passwordHash: string | null;

  @Column({ type: 'enum', enum: ROLES })
  role: UserRole;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  // ── Campos del onboarding ─────────────────────────────────────────────

  // RUT chileno — dato sensible; usar cifrado en reposo en producción
  @Column({ nullable: true })
  rut: string | null;

  @Column({ nullable: true })
  phone: string | null;

  @Column({ type: 'date', nullable: true })
  birthDate: string | null;

  @Column({ nullable: true })
  address: string | null;

  @Column({ nullable: true })
  referralSource: string | null;

  @Column({ nullable: true })
  sedeId: string | null;

  @Column({
    type: 'enum',
    enum: ONBOARDING_STATUSES,
    nullable: true,
  })
  onboardingStatus: OnboardingStatus | null;

  // ── Estado de cuenta ─────────────────────────────────────────────────

  @Column({ type: 'enum', enum: ACCOUNT_STATUSES, default: 'active' })
  accountStatus: AccountStatus;

  // ── Progreso ──────────────────────────────────────────────────────────

  @Column({ type: 'int', default: 0 })
  daysStreak: number;

  @Column({ type: 'date', nullable: true })
  lastGambleDate: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
