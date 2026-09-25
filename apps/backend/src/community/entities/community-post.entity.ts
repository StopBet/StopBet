import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CommunityPostType } from '@stopbet/shared-types';
import { User } from '../../users/entities/user.entity';

const POST_TYPES: CommunityPostType[] = ['announcement', 'forum_post'];

@Entity('community_posts')
export class CommunityPost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  authorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'authorId' })
  author: User;

  @Column({ type: 'enum', enum: POST_TYPES })
  type: CommunityPostType;

  @Column()
  sede: string;

  @Column({ nullable: true })
  title: string | null;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'timestamptz', nullable: true })
  eventDate: Date | null;

  @Column({ type: 'int', default: 0 })
  reportCount: number;

  /**
   * Los días que celebra el mensaje, cuando es un logro compartido.
   *
   * Sin esto, un logro es un texto más y la única forma de reconocerlo sería mirar si
   * empieza con 🏅, que se rompe a la primera vez que alguien cambie la frase. Con el dato
   * aparte, la app puede darle la tarjeta que merece: es lo que la comunidad celebra.
   */
  @Column({ type: 'int', nullable: true })
  achievementDays: number | null;

  /**
   * El mensaje al que este responde, si cita a alguno.
   *
   * El foro dejó de ser publicaciones con hilos colgando: es una conversación plana donde
   * cualquier mensaje puede citar a otro, como en WhatsApp. Las respuestas que estaban en
   * `post_replies` se movieron acá (`pnpm run migrate:replies`).
   *
   * `SET NULL` y no `CASCADE`: si el psicólogo borra un mensaje reportado, las respuestas
   * de los demás no tienen por qué desaparecer con él.
   */
  @Column({ type: 'uuid', nullable: true })
  replyToId: string | null;

  @ManyToOne(() => CommunityPost, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'replyToId' })
  replyTo: CommunityPost | null;

  // Idempotencia (ver `createPost`): la app manda un id propio por acción y lo
  // conserva al reintentar. Si la respuesta se pierde de vuelta —el paciente ve
  // "sin conexión" aunque el post ya se guardó— el reintento trae el mismo id y
  // no duplica. Nullable porque los posts existentes y los que crea el backend
  // (alerta de pánico, insignia) no lo llevan; en Postgres varios NULL conviven
  // con un índice único.
  @Column({ type: 'varchar', length: 64, nullable: true, unique: true })
  clientRequestId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
