import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ClinicalRecordFieldChange } from '@stopbet/shared-types';

// HdU13 CA4: el historial de auditoría clínica. Una fila por guardado que haya cambiado algo.
//
// Se guarda el **diff** y no un snapshot de la ficha entera. El CA pide "los campos que
// cambiaron en cada una", que con snapshots habría que recalcular comparando pares de filas en
// cada lectura; con el diff ya escrito, el historial se lee tal cual quedó. El costo es que
// reconstruir la ficha completa en una fecha dada exige recorrer las versiones hacia atrás,
// cosa que ningún CA pide hoy.
//
// Nunca se actualiza ni se borra: es el registro de auditoría. Si una versión se pudiera
// editar, no serviría para sustentar una decisión de tratamiento.
@Entity('clinical_record_versions')
export class ClinicalRecordVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  recordId: string;

  // Correlativo por ficha, empezando en 1. Se calcula dentro de la misma transacción que
  // escribe la ficha para que dos guardados simultáneos no reciban el mismo número.
  @Column({ type: 'int' })
  versionNumber: number;

  @Column()
  changedBy: string;

  @Column({ type: 'jsonb' })
  changedFields: ClinicalRecordFieldChange[];

  @CreateDateColumn()
  changedAt: Date;
}
