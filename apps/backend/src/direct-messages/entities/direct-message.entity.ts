import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { GifAttachment } from '@stopbet/shared-types';
import { User } from '../../users/entities/user.entity';
import { DirectConversation } from './direct-conversation.entity';

@Entity('direct_messages')
@Index(['conversationId', 'createdAt'])
export class DirectMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  conversationId: string;

  @ManyToOne(() => DirectConversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversationId' })
  conversation: DirectConversation;

  @Column()
  senderId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'senderId' })
  sender: User;

  @Column({ type: 'text' })
  body: string;

  /**
   * El GIF que acompaña al mensaje, ya revisado por el filtro de apuestas. Se guarda entero y no
   * solo el id para no depender de GIPHY al leer el chat. Con GIF, `body` puede ir vacío.
   */
  @Column({ type: 'jsonb', nullable: true })
  gif: GifAttachment | null;

  // `SET NULL` como en el foro: borrar el original no se lleva las respuestas.
  @Column({ type: 'uuid', nullable: true })
  replyToId: string | null;

  @ManyToOne(() => DirectMessage, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'replyToId' })
  replyTo: DirectMessage | null;

  @Column({ type: 'int', default: 0 })
  reportCount: number;

  // Misma idempotencia que el foro (ver `community_posts.clientRequestId`): contra Railway la
  // respuesta de un POST puede perderse con el mensaje ya guardado.
  @Column({ type: 'varchar', length: 64, nullable: true, unique: true })
  clientRequestId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
