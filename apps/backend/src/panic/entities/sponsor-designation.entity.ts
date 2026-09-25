import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

// El rol de padrino no vive en `User.role` a propósito. `role` es un solo valor, y un
// padrino sigue siendo paciente: si se le cambiara el rol perdería su check-in, sus
// logros, su ficha clínica y su propio botón de pánico. HdU21 CA2 lo dice de frente al
// pedir "pacientes activos que aún no tienen el rol de padrino" — es un rol que se suma,
// no uno que reemplaza. Ningún guard exige `@Roles('sponsor')`, así que la designación
// puede vivir acá sin dejar a nadie fuera de un endpoint.
@Entity('sponsor_designations')
export class SponsorDesignation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  patientId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patientId' })
  patient: User;

  // CA21.1 pide registrar quién designó y cuándo. Se guarda el psicólogo, no solo la
  // fecha: la designación es un juicio clínico y tiene que poder atribuirse a alguien.
  @Column()
  designatedBy: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'designatedBy' })
  designatedByUser: User;

  // Append-only, igual que `patient_assignments`: revocar no borra la fila, la cierra.
  // En un sistema clínico hay que poder responder quién era padrino en una fecha dada,
  // y un DELETE borra esa respuesta.
  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  designatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  revokedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  revokedBy: string | null;
}
