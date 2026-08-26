import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

// CA5.6: existencia de fila = notificaciones de comunidad silenciadas para ese usuario
@Entity('community_mutes')
export class CommunityMute {
  @PrimaryColumn()
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn()
  mutedAt: Date;
}
