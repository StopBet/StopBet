import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { FamilyLinkVerification } from './family-link.entity';

export type FamilyLinkVerdict = 'confirmed' | 'rejected' | 'revoked';

// HDU 23 CA6: autor, fecha y veredicto de cada decisión sobre un vínculo. `family_links`
// guarda solo la última (reviewedBy/reviewedAt): si un psicólogo confirma y otro revoca
// después, ahí ya no queda quién dio el acceso, y en una plataforma clínica eso importa.
//
// Nunca se actualiza ni se borra, igual que clinical_record_versions. Sin FK hacia el vínculo
// a propósito: la auditoría no debe desaparecer en cascada con la fila que audita.
@Entity('family_link_reviews')
export class FamilyLinkReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  linkId: string;

  @Column({ type: 'varchar' })
  verdict: FamilyLinkVerdict;

  @Column()
  reviewedBy: string;

  // Solo en las confirmaciones (HDU 23 CA4).
  @Column({ type: 'varchar', nullable: true })
  verification: FamilyLinkVerification | null;

  @CreateDateColumn({ type: 'timestamptz' })
  reviewedAt: Date;
}
