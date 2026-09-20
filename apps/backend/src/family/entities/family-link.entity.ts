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

// rejected: el psicólogo determinó que el paciente declarado no le corresponde (HDU 23,
// CA3). revoked: un vínculo activo al que se le retiró el acceso (HDU 23, CA5) — estado
// aparte de rejected para no perder en el historial que alguna vez estuvo vigente.
export type FamilyLinkStatus = 'pending' | 'active' | 'rejected' | 'revoked';

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

  // Auditoría clínica (HDU 23, CA6): quién y cuándo tomó la última decisión sobre este
  // vínculo (confirmar, rechazar o revocar). Se sobreescribe en cada acción — el veredicto
  // vigente es el de `status`, no hace falta un historial de versiones acá.
  @Column({ nullable: true })
  reviewedBy: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
