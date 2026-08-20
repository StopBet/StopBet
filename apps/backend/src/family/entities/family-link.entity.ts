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

  @Column()
  patientUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patientUserId' })
  patientUser: User;

  // pending: solicitado pero el psicólogo no ha aprobado aún (CA 11.6)
  @Column({ type: 'varchar', default: 'pending' })
  status: FamilyLinkStatus;

  @CreateDateColumn()
  createdAt: Date;
}
