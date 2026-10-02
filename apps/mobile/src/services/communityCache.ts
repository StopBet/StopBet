import type { CommunityPost } from '@stopbet/shared-types';
import { readCommunity, saveCommunity } from './offlineStore';

/**
 * Lo último cargado de la comunidad, para mostrarlo sin conexión (CA4).
 *
 * Vivía dentro de `CommunityScreen`; desde que el chat de la sede tiene pantalla propia, los
 * anuncios y los mensajes los cargan dos pantallas distintas y cada una actualiza su mitad.
 * Sobrevive a navegar; el reinicio de la app lo cubre el respaldo en disco.
 */
const memoria: { userId: string | null; announcements: CommunityPost[]; posts: CommunityPost[] } = {
  // Sin el id, al cambiar de cuenta el foro de la sede anterior se mostraba como propio.
  userId: null,
  announcements: [],
  posts: [],
};

function deEstaCuenta(userId: string) {
  if (memoria.userId !== userId) {
    memoria.userId = userId;
    memoria.announcements = [];
    memoria.posts = [];
  }
}

export function guardarEnCaché(
  userId: string,
  parte: { announcements?: CommunityPost[]; posts?: CommunityPost[] },
): void {
  deEstaCuenta(userId);
  if (parte.announcements) memoria.announcements = parte.announcements;
  if (parte.posts) memoria.posts = parte.posts;
  saveCommunity(userId, { announcements: memoria.announcements, posts: memoria.posts });
}

/** Lo que haya: primero la memoria y, si está vacía (la app recién abierta), el disco. */
export async function leerDeCaché(
  userId: string,
): Promise<{ announcements: CommunityPost[]; posts: CommunityPost[] }> {
  deEstaCuenta(userId);
  if (!memoria.posts.length && !memoria.announcements.length) {
    const guardado = await readCommunity(userId);
    if (guardado) {
      memoria.announcements = guardado.announcements;
      memoria.posts = guardado.posts;
    }
  }
  return { announcements: memoria.announcements, posts: memoria.posts };
}
