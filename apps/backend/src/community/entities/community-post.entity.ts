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
