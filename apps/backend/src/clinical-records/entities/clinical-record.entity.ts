import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// HdU13: una ficha por paciente. Los cinco campos del CA1 se guardan como `text` y no como
// `varchar`: son relatos clínicos, no etiquetas, y truncar el motivo de consulta a 255
// caracteres se descubre recién cuando un psicólogo pierde media página al guardar.
//
// El contenido va acá y solo acá; `clinical_record_versions` guarda el diff de cada guardado,
// no una copia entera de la ficha.
@Entity('clinical_records')
export class ClinicalRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Única: la ficha es del paciente, no del psicólogo que la escribe. Si mañana lo reasignan,
  // la ficha sigue siendo la misma y el historial no se parte en dos.
  @Index({ unique: true })
  @Column()
  patientId: string;

  @Column({ type: 'text', default: '' })
  admissionReason: string;

  @Column({ type: 'text', default: '' })
  gamblingHistory: string;

  @Column({ type: 'text', default: '' })
  triggers: string;

  @Column({ type: 'text', default: '' })
  healthAndSupport: string;

  @Column({ type: 'text', default: '' })
  treatmentGoals: string;

  // CA2: autor de la última modificación. Se guarda el id y no el nombre porque el nombre
  // cambia; para mostrarlo se resuelve contra `users` al leer.
  @Column()
  updatedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
