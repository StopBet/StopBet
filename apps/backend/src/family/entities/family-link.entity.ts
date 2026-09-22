import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { encryptedColumnTransformer } from '../../common/crypto/encrypted-column.transformer';

export type FamilyLinkStatus = 'pending' | 'active';

@Unique(['familyUserId', 'patientUserId'])
@Entity('family_links')
export class FamilyLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  familyUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'familyUserId' })
  familyUser: User;

  // Nulo cuando el familiar declaró un RUT que no corresponde a ningún paciente (HDU 22,
  // CA2): el intento queda registrado igual, sin inventar un paciente para vincular.
  @Column({ nullable: true })
  patientUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'patientUserId' })
  patientUser: User | null;

  // RUT que el familiar declaró al registrarse, cifrado igual que User.rut. Solo se
  // completa cuando no hubo paciente que vincular (patientUserId nulo) — sirve para que
  // el coordinador revise el intento sin guardar el RUT en texto plano.
  @Column({ nullable: true, transformer: encryptedColumnTransformer })
  declaredPatientRut: string | null;

  // pending: solicitado pero el psicólogo no ha aprobado aún (CA 11.6)
  @Column({ type: 'varchar', default: 'pending' })
  status: FamilyLinkStatus;

  @CreateDateColumn()
  createdAt: Date;
}
