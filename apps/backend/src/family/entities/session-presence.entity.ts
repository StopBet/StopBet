import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { FamilySession } from './family-session.entity';
import { User } from '../../users/entities/user.entity';

// HdU14 CA4 — quién asistió de verdad, registrado por el psicólogo después de la sesión.
// Tabla aparte de `session_attendances` a propósito: esa guarda lo que la persona dijo que
// haría (confirmó o no), esta lo que pasó. Alguien que no respondió también puede asistir.
@Unique(['sessionId', 'userId'])
@Entity('session_presences')
export class SessionPresence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sessionId: string;

  @ManyToOne(() => FamilySession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sessionId' })
  session: FamilySession;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  attended: boolean;

  // Quién pasó lista por última vez, para saber a quién preguntar si hay un error.
  @Column()
  markedBy: string;

  @UpdateDateColumn()
  markedAt: Date;
}
