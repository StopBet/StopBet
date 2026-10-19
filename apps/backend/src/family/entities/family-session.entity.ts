import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

// HdU14 — a quién va dirigida: las de pacientes las ve solo la sede; las de
// familiares, los pacientes (app) y sus familiares vinculados (web).
export const SESSION_AUDIENCES = ['patients', 'family'] as const;
export type SessionAudience = (typeof SESSION_AUDIENCES)[number];

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

  // Sesiones que forman parte del tratamiento del paciente: el familiar no elige
  // si le corresponden, solo puede avisar que no podrá asistir. Por defecto false
  // para que las sesiones ya creadas sigan siendo opcionales.
  @Column({ default: false })
  isMandatory: boolean;

  // HdU14 CA1. Nullable porque las sesiones creadas antes no lo tenían: sin cupo, sin tope.
  @Column({ type: 'int', nullable: true })
  capacity: number | null;

  // Por defecto 'family': todas las sesiones anteriores eran de familiares (HdU11).
  @Column({ type: 'varchar', default: 'family' })
  audience: SessionAudience;

  @CreateDateColumn()
  createdAt: Date;
}
