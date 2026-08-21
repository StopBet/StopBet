import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Los tokens de dispositivo son transversales (los usará cualquier módulo que
// necesite notificar), por eso viven en su propio módulo y no dentro de users/.
@Entity('device_tokens')
export class DeviceToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  userId: string;

  // FCM entrega un token distinto por instalación, y lo rota por su cuenta.
  // Único para que reinstalar la app no acumule filas muertas.
  @Column({ unique: true })
  token: string;

  @Column({ type: 'varchar', nullable: true })
  platform: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
