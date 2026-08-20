import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('family_sessions')
export class FamilySession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  // ISO datetime string — almacenado como timestamp para ordenar por proximidad (CA 11.1)
  @Column({ type: 'timestamptz' })
  sessionDate: Date;

  // Nombre del lugar o "Online" si isOnline = true
  @Column()
  location: string;

  @Column({ default: false })
  isOnline: boolean;

  @Column()
  sedeId: string;

  @CreateDateColumn()
  createdAt: Date;
}
