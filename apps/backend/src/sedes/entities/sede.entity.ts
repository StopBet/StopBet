import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { SedeType } from '@stopbet/shared-types';

const SEDE_TYPES: SedeType[] = ['presential', 'online'];

@Entity('sedes')
export class Sede {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  address: string;

  @Column({ type: 'int', default: 0 })
  activeGroups: number;

  @Column({ type: 'enum', enum: SEDE_TYPES, default: 'presential' })
  type: SedeType;

  @Column({ default: true })
  isActive: boolean;
}
