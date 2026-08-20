import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { FamilySession } from './family-session.entity';
import { User } from '../../users/entities/user.entity';

@Unique(['sessionId', 'familyUserId'])
@Entity('session_attendances')
export class SessionAttendance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sessionId: string;

  @ManyToOne(() => FamilySession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sessionId' })
  session: FamilySession;

  @Column()
  familyUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'familyUserId' })
  familyUser: User;

  // true = confirma asistencia, false = rechaza (CA 11.4)
  @Column()
  confirmed: boolean;

  @CreateDateColumn()
  confirmedAt: Date;
}
