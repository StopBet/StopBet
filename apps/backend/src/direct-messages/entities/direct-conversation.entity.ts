import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * Una conversación entre dos personas.
 *
 * El par se guarda **ordenado** (`userAId` < `userBId`) para que el índice único lo reconozca
 * sin importar quién escribió primero: sin eso, dos personas que se escriben a la vez podían
 * terminar con dos conversaciones partidas.
 */
@Entity('direct_conversations')
@Index(['userAId', 'userBId'], { unique: true })
export class DirectConversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userAId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userAId' })
  userA: User;

  @Column()
  userBId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userBId' })
  userB: User;

  /** El nombre de la sede donde se abrió: es lo que filtra la cola de moderación. */
  @Column()
  sede: string;

  /** Ordena la lista de chats. Null hasta el primer mensaje. */
  @Column({ type: 'timestamptz', nullable: true })
  lastMessageAt: Date | null;

  // Hasta dónde leyó cada uno. Un solo instante por persona basta para contar no leídos y
  // evita una fila por mensaje leído, que es lo que crece más rápido en un chat.
  @Column({ type: 'timestamptz', nullable: true })
  userALastReadAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  userBLastReadAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
