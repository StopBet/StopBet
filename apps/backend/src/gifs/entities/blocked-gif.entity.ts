import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * Un GIF que el equipo clínico sacó por moderación. No vuelve a aparecer en el buscador y
 * nadie puede enviarlo de nuevo: el filtro de palabras lee títulos, no la imagen, y esto es
 * lo que cubre lo que se le escapa. No se edita ni se borra, como el resto de la moderación.
 */
@Entity('blocked_gifs')
export class BlockedGif {
  // El id de GIPHY: alfanumérico y corto, igual que lo valida `gifId` en los DTOs.
  @PrimaryColumn({ type: 'varchar', length: 40 })
  gifId: string;

  // Para que se entienda qué es al revisar la tabla, sin tener que buscarlo en GIPHY.
  @Column({ type: 'varchar', length: 200, default: '' })
  title: string;

  @Column({ type: 'uuid' })
  blockedBy: string;

  @CreateDateColumn()
  createdAt: Date;
}
