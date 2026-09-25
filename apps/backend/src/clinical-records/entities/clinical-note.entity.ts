import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Anotaciones del seguimiento: lo que pasa sesión a sesión, que no cabe en los cinco campos de
// la ficha sin reescribirlos. Cada una queda con su fecha y su autor.
//
// **Van aparte de `clinical_records` a propósito.** La ficha describe el caso y se corrige; las
// anotaciones son una cronología y se acumulan. Metidas como un sexto campo, cada nota nueva
// habría reescrito la anterior y el psicólogo habría perdido el hilo de lo que fue pasando.
//
// Igual que las versiones de la ficha, **no se editan ni se borran**: son registro clínico. Una
// nota que se puede cambiar después no sirve para sustentar una decisión de tratamiento.
@Entity('clinical_notes')
export class ClinicalNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Cuelga del paciente y no de la ficha: se puede anotar antes de que la ficha exista, que es
  // justo lo que pasa cuando alguien llega al grupo y todavía no hay entrevista de ingreso.
  @Index()
  @Column()
  patientId: string;

  @Column()
  authorId: string;

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn()
  createdAt: Date;
}
