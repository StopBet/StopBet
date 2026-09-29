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

// HDU 23 CA4 — cómo verificó el psicólogo que el familiar corresponde al paciente.
export const FAMILY_LINK_VERIFICATIONS = ['patient_consulted', 'in_person'] as const;
export type FamilyLinkVerification = (typeof FAMILY_LINK_VERIFICATIONS)[number];

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

  // Nulo cuando el familiar declaró un RUT o correo que no corresponde a ningún paciente
  // (HDU 22, CA2): el intento queda registrado igual, sin inventar un paciente para vincular.
  @Column({ nullable: true })
  patientUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'patientUserId' })
  patientUser: User | null;

  // Lo que el familiar declaró (RUT y/o correo), cifrado igual que User.rut: identifica a una
  // persona que quizá ni siquiera es paciente. Se guarda haya coincidido o no, porque sirve
  // para dos cosas: que coordinación revise los intentos sin paciente, y reconocer una
  // solicitud repetida (HDU 22 CA6) comparando contra lo declarado y no contra los pacientes,
  // así el aviso de "ya está en revisión" no delata si el paciente existe.
  @Column({ nullable: true, transformer: encryptedColumnTransformer })
  declaredPatientRut: string | null;

  @Column({ nullable: true, transformer: encryptedColumnTransformer })
  declaredPatientEmail: string | null;

  // pending: solicitado pero el psicólogo no ha aprobado aún (CA 11.6)
  @Column({ type: 'varchar', default: 'pending' })
  status: FamilyLinkStatus;

  // Quién y cuándo tomó la última decisión (confirmar, rechazar o revocar). Se sobreescribe
  // en cada acción: la auditoría completa de HDU 23 CA6 está en family_link_reviews.
  @Column({ nullable: true })
  reviewedBy: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  // Cómo se verificó la última confirmación (HDU 23 CA4). Queda también en family_link_reviews.
  @Column({ type: 'varchar', nullable: true })
  verification: FamilyLinkVerification | null;

  @CreateDateColumn()
  createdAt: Date;
}
