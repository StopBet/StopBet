import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { GifAttachment, GifSearchResponse } from '@stopbet/shared-types';
import { contieneTerminoBloqueado } from './gif-blocklist';
import { GiphyClient, type GifDeGiphy } from './giphy.client';

export const GIFS_POR_PAGINA = 24;

@Injectable()
export class GifsService {
  constructor(private readonly giphy: GiphyClient) {}

  /**
   * Busca en GIPHY con el filtro de apuestas en dos capas: si la búsqueda tiene un término
   * bloqueado no se consulta a nadie, y de lo que vuelve se descarta todo GIF cuyo título o
   * descripción tenga uno. El filtro lee palabras, no la imagen: lo que se cuele se reporta.
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
    return { gifs: encontrados.filter(esApto).map((e) => e.gif), blocked: false };
  }

  /**
   * El GIF que se va a guardar en un mensaje. Se vuelve a pedir a GIPHY por id en vez de creer
   * lo que manda el cliente: así nadie guarda una URL arbitraria ni un GIF que el filtro saca.
   */
  async resolver(id: string): Promise<GifAttachment> {
    this.exigirActivo();
    const encontrado = await this.giphy.porId(id).catch(() => {
      throw new ServiceUnavailableException('Los GIFs no están disponibles en este momento');
    });
    if (!encontrado || !esApto(encontrado)) {
      throw new BadRequestException('Ese GIF no se puede enviar');
    }
    return encontrado.gif;
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
