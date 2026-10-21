import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { GifAttachment } from '@stopbet/shared-types';

const API = 'https://api.giphy.com/v1/gifs';
const TIMEOUT_MS = 5_000;
// Solo se guardan URLs de la CDN de GIPHY: un mensaje no puede terminar apuntando a otro lado.
const CDN = /^https:\/\/media\d*\.giphy\.com\//;

/** Lo que el filtro de apuestas necesita leer de cada GIF, además del GIF en sí. */
export interface GifDeGiphy {
  gif: GifAttachment;
  /** Título, slug, texto alternativo y usuario: todo lo que describe la imagen en palabras. */
  textos: string[];
}

/**
 * Única puerta hacia GIPHY. Cambiar de proveedor tiene que tocar este archivo y nada más.
 *
 * Igual que MailService y OneclickGateway, es opcional: sin `GIPHY_API_KEY` el backend arranca
 * igual y el buscador responde 503. A GIPHY no le llega nada que identifique al paciente: las
 * búsquedas salen del servidor, sin ids de usuario.
 */
@Injectable()
export class GiphyClient {
  private readonly logger = new Logger(GiphyClient.name);
  private readonly apiKey: string | null;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('GIPHY_API_KEY')?.trim() || null;
    if (!this.apiKey) this.logger.warn('GIPHY sin configurar: el buscador de GIFs queda apagado');
  }

  get activo(): boolean {
    return this.apiKey !== null;
  }

  /** Sin texto devuelve los GIFs del momento, como el buscador de WhatsApp al abrirlo. */
  async buscar(texto: string, offset: number, limite: number): Promise<GifDeGiphy[]> {
    const params = new URLSearchParams({
      limit: String(limite),
      offset: String(offset),
      // «g»: apto para todo público. No filtra apuestas; eso lo hace gif-blocklist.
      rating: 'g',
    });
    const ruta = texto ? 'search' : 'trending';
    if (texto) {
      params.set('q', texto);
      params.set('lang', 'es');
    }
    const cuerpo = await this.pedir(`${API}/${ruta}?${params}`);
    const datos = (cuerpo as { data?: unknown })?.data;
    return Array.isArray(datos) ? datos.flatMap((d) => leer(d) ?? []) : [];
  }

  async porId(id: string): Promise<GifDeGiphy | null> {
    const cuerpo = await this.pedir(`${API}/${encodeURIComponent(id)}?`);
    return leer((cuerpo as { data?: unknown })?.data);
  }

  private async pedir(url: string): Promise<unknown> {
    if (!this.apiKey) throw new Error('GIPHY sin configurar');
    const res = await fetch(`${url}&api_key=${this.apiKey}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // Un id que no existe es un 404, no una falla: se responde como «no hay GIF».
    if (res.status === 404) return null;
    if (!res.ok) {
      // Sin la URL: lleva la API key.
      this.logger.error(`GIPHY respondió ${res.status}`);
      throw new Error(`GIPHY respondió ${res.status}`);
    }
    return res.json();
  }
}

interface ImagenGiphy {
  url?: unknown;
  width?: unknown;
  height?: unknown;
}

/** La respuesta de GIPHY se lee como `unknown` y se valida antes de tipar. */
function leer(d: unknown): GifDeGiphy | null {
  if (!d || typeof d !== 'object') return null;
  const g = d as Record<string, unknown>;
  const imagenes = (g.images ?? {}) as Record<string, ImagenGiphy | undefined>;
  const grande = imagenes.fixed_width;
  const chica = imagenes.fixed_width_small ?? grande;
  if (typeof g.id !== 'string' || !grande || !chica) return null;

  const url = grande.url;
  const previewUrl = chica.url;
  if (typeof url !== 'string' || !CDN.test(url)) return null;
  if (typeof previewUrl !== 'string' || !CDN.test(previewUrl)) return null;

  const texto = (v: unknown) => (typeof v === 'string' ? v : '');
  const usuario = (g.user ?? {}) as Record<string, unknown>;
  return {
    gif: {
      id: g.id,
      title: texto(g.title),
      url,
      previewUrl,
      width: Number(grande.width) || 200,
      height: Number(grande.height) || 200,
    },
    textos: [
      texto(g.title),
      texto(g.slug),
      texto(g.alt_text),
      texto(g.username),
      texto(usuario.display_name),
    ],
  };
}
