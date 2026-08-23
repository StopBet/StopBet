import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// M2M psicólogo ↔ sede (HdU24 CA24.1, CA24.5). `User.sedeId` sigue siendo un solo
// string legado; esta tabla es la fuente de verdad para psicólogos con varias sedes.
@Entity('psychologist_sedes')
export class PsychologistSede {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  psychologistId: string;

  @Column()
  sedeId: string;

  @CreateDateColumn()
  createdAt: Date;
}
