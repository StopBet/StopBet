import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { GifAttachment, GifSearchResponse } from '@stopbet/shared-types';
import { BlockedGif } from './entities/blocked-gif.entity';
import { contieneTerminoBloqueado } from './gif-blocklist';
import { GiphyClient, type GifDeGiphy } from './giphy.client';

export const GIFS_POR_PAGINA = 24;

@Injectable()
export class GifsService {
  constructor(
    private readonly giphy: GiphyClient,
    @InjectRepository(BlockedGif)
    private readonly bloqueados: Repository<BlockedGif>,
  ) {}

  /**
   * Busca en GIPHY con el filtro de apuestas en dos capas: si la búsqueda tiene un término
   * bloqueado no se consulta a nadie, y de lo que vuelve se descarta todo GIF cuyo título o
   * descripción tenga uno. El filtro lee palabras, no la imagen: lo que se cuele se reporta, y
   * lo que el equipo clínico elimina por moderación tampoco vuelve a aparecer.
   */
  async buscar(texto: string, offset = 0): Promise<GifSearchResponse> {
    this.exigirActivo();
    const q = texto.trim();
    if (contieneTerminoBloqueado(q)) return { gifs: [], blocked: true };

    const encontrados = await this.giphy
      .buscar(q, offset, GIFS_POR_PAGINA)
      .catch(() => {
        throw new ServiceUnavailableException('Los GIFs no están disponibles en este momento');
      });
    const aptos = encontrados.filter(esApto).map((e) => e.gif);
    const sacados = await this.idsBloqueados(aptos.map((g) => g.id));
    return { gifs: aptos.filter((g) => !sacados.has(g.id)), blocked: false };
  }

  /**
   * El GIF que se va a guardar en un mensaje. Se vuelve a pedir a GIPHY por id en vez de creer
   * lo que manda el cliente: así nadie guarda una URL arbitraria ni un GIF que el filtro saca.
   */
  async resolver(id: string): Promise<GifAttachment> {
    this.exigirActivo();
    if ((await this.idsBloqueados([id])).size) {
      throw new BadRequestException('Ese GIF no se puede enviar');
    }
    const encontrado = await this.giphy.porId(id).catch(() => {
      throw new ServiceUnavailableException('Los GIFs no están disponibles en este momento');
    });
    if (!encontrado || !esApto(encontrado)) {
      throw new BadRequestException('Ese GIF no se puede enviar');
    }
    return encontrado.gif;
  }

  /**
   * Lo llama la moderación al eliminar un mensaje reportado que traía un GIF. No falla si ya
   * estaba bloqueado: dos psicólogos pueden eliminar copias del mismo GIF.
   */
  async bloquear(gif: GifAttachment, moderadorId: string): Promise<void> {
    await this.bloqueados
      .createQueryBuilder()
      .insert()
      .values({ gifId: gif.id, title: gif.title.slice(0, 200), blockedBy: moderadorId })
      .orIgnore()
      .execute();
  }

  private async idsBloqueados(ids: string[]): Promise<Set<string>> {
    if (!ids.length) return new Set();
    const filas = await this.bloqueados.find({ where: { gifId: In(ids) }, select: ['gifId'] });
    return new Set(filas.map((f) => f.gifId));
  }

  private exigirActivo() {
    if (!this.giphy.activo) {
      throw new ServiceUnavailableException('Los GIFs no están disponibles en este momento');
    }
  }
}

function esApto(e: GifDeGiphy): boolean {
  return !e.textos.some((t) => contieneTerminoBloqueado(t));
}
