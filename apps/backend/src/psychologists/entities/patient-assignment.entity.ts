import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Vínculo paciente → psicólogo (HdU24 CA24.3, CA24.5). No existía ningún registro de
// esto en el modelo de datos: `RegistrationRequest.reviewedBy` solo guarda quién revisó
// la solicitud, no a quién quedó asignado el paciente.
@Entity('patient_assignments')
export class PatientAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  patientId: string;

  @Column()
  psychologistId: string;

  @Column()
  sedeId: string;

  // Append-only: una reasignación no sobrescribe la fila, la cierra y abre otra. En un
  // sistema clínico hay que poder responder quién atendía a un paciente en una fecha dada,
  // y un UPDATE sobre psychologistId borra esa respuesta.
  @Column({ default: true })
  active: boolean;

  @CreateDateColumn()
  assignedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  endedAt: Date | null;
}
