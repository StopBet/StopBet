import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { encryptedColumnTransformer } from '../../common/crypto/encrypted-column.transformer';

export type PaymentInscriptionStatus = 'pending' | 'active' | 'failed' | 'aborted' | 'deleted';

const STATUSES: PaymentInscriptionStatus[] = ['pending', 'active', 'failed', 'aborted', 'deleted'];

// Una tarjeta enrolada en Webpay Oneclick (SPIKE 2 CA6). StopBet nunca ve el número: el
// paciente lo escribe en el formulario de Transbank, y acá solo queda el `tbkUser` (la
// credencial para cobrarle sin él), el tipo de tarjeta y sus últimos 4 dígitos.
//
// Sin FK hacia users, igual que family_link_reviews: es un registro de lo que pasó con el
// dinero de una persona y no debería desaparecer en cascada con su cuenta.
//
// Un paciente puede tener varias inscripciones `pending` (abrió el formulario dos veces), pero
// solo una `active`: la restricción vive en la base, no en un findOne que dos pedidos
// simultáneos pueden saltarse.
@Entity('payment_inscriptions')
@Index(['userId'], { unique: true, where: `"status" = 'active'` })
export class PaymentInscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ type: 'varchar', default: 'transbank_oneclick' })
  provider: string;

  @Column({ type: 'enum', enum: STATUSES, default: 'pending' })
  status: PaymentInscriptionStatus;

  // Transbank pide un nombre de usuario de hasta 40 caracteres. Se usa el id del paciente: no
  // identifica a nadie fuera de nuestra base y cabe (36).
  @Column({ length: 40 })
  username: string;

  // Token de la inscripción en curso. Es lo único que vuelve en la URL del retorno.
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64, nullable: true })
  token: string | null;

  // Cifrado en reposo como el RUT. Es `text` y no varchar(40): el valor cifrado
  // (iv:tag:texto, en hex) es bastante más largo que los 40 caracteres del original.
  @Column({ type: 'text', nullable: true, transformer: encryptedColumnTransformer })
  tbkUser: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  cardType: string | null;

  @Column({ type: 'varchar', length: 4, nullable: true })
  cardLast4: string | null;

  @Column({ type: 'varchar', length: 6, nullable: true })
  authorizationCode: string | null;

  @Column({ type: 'int', nullable: true })
  responseCode: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt: Date | null;
}
