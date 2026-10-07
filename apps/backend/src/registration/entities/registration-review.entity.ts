import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { UserRole } from '@stopbet/shared-types';

export type RegistrationVerdict = 'approved' | 'rejected' | 'reopened';

// HdU19 CA6: autor, rol, fecha y veredicto de cada decisión sobre una solicitud de ingreso.
// `registration_requests` guarda solo la última (reviewedBy/reviewedAt) y al reabrir se limpia:
// sin esta tabla no quedaría quién rechazó ni quién la reabrió después.
//
// Nunca se actualiza ni se borra, igual que family_link_reviews. Sin FK hacia la solicitud
// a propósito: la auditoría no debe desaparecer en cascada con la fila que audita.
@Entity('registration_reviews')
export class RegistrationReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  requestId: string;

  @Column({ type: 'varchar' })
  verdict: RegistrationVerdict;

  @Column()
  reviewedBy: string;

  // El rol se guarda al momento de decidir porque puede cambiar después (HdU24).
  @Column({ type: 'varchar' })
  reviewerRole: UserRole;

  @CreateDateColumn({ type: 'timestamptz' })
  reviewedAt: Date;
}
