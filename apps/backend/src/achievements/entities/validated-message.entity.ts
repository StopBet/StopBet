import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Mensajes de contención validados por AJUTER, mostrados ante una recaída.
// No editar el contenido sin revisión clínica.
@Entity('validated_messages')
export class ValidatedMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  body: string;
}
