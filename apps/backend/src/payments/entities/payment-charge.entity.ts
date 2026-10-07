import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type PaymentChargeStatus = 'processing' | 'authorized' | 'rejected' | 'error';
export type PaymentChargeTrigger = 'user' | 'automatic';

const STATUSES: PaymentChargeStatus[] = ['processing', 'authorized', 'rejected', 'error'];
const TRIGGERS: PaymentChargeTrigger[] = ['user', 'automatic'];

// Un intento de cobro de una cuota con una tarjeta enrolada (SPIKE 2 CA6).
//
// La fila se inserta en `processing` ANTES de llamar a Transbank. Así, si el proceso se cae
// justo después de que Transbank cobró, queda rastro de que hubo un cobro en vuelo, y el índice
// único de abajo impide que un reintento cobre la misma cuota por segunda vez.
//
// Sin FK, como el resto de los registros de auditoría: ni borrar la cuota ni la cuenta debe
// borrar el rastro de un cobro.
@Entity('payment_charges')
// Una cuota tiene a lo más un cobro en curso o autorizado. Un cobro rechazado o con error
// no cuenta: la cuota queda libre para volver a intentarlo.
@Index(['invoiceId'], { unique: true, where: `"status" IN ('processing', 'authorized')` })
export class PaymentCharge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  invoiceId: string;

  @Column()
  inscriptionId: string;

  // Transbank exige órdenes de compra únicas de hasta 26 caracteres. El padre agrupa los
  // cobros del mall y el hijo es el de nuestra única tienda; el hijo también es único.
  @Index({ unique: true })
  @Column({ length: 26 })
  parentBuyOrder: string;

  @Index({ unique: true })
  @Column({ length: 26 })
  childBuyOrder: string;

  @Column({ type: 'int' })
  amountCLP: number;

  // `user`: lo pidió el paciente. `automatic`: lo disparó el backend sin él (CA6, segundo cobro).
  @Column({ type: 'enum', enum: TRIGGERS })
  triggeredBy: PaymentChargeTrigger;

  @Column({ type: 'enum', enum: STATUSES, default: 'processing' })
  status: PaymentChargeStatus;

  @Column({ type: 'int', nullable: true })
  responseCode: number | null;

  @Column({ type: 'varchar', length: 6, nullable: true })
  authorizationCode: string | null;

  @Column({ type: 'varchar', length: 2, nullable: true })
  paymentTypeCode: string | null;

  @Column({ type: 'int', nullable: true })
  installmentsNumber: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  transactionDate: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
