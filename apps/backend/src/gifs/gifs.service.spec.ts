import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { GifsService } from './gifs.service';
import type { GifDeGiphy } from './giphy.client';

function gif(id: string, title: string, otros: string[] = []): GifDeGiphy {
  return {
    gif: {
      id,
      title,
      url: `https://media1.giphy.com/media/${id}/200w.gif`,
      previewUrl: `https://media1.giphy.com/media/${id}/100w.gif`,
      width: 200,
      height: 150,
    },
    textos: [title, ...otros],
  };
}

describe('GifsService', () => {
  let giphy: { activo: boolean; buscar: jest.Mock; porId: jest.Mock };
  let service: GifsService;

  beforeEach(() => {
    giphy = { activo: true, buscar: jest.fn().mockResolvedValue([]), porId: jest.fn() };
    service = new GifsService(giphy as any);
  });

  it('una búsqueda con un término bloqueado no llega a GIPHY', async () => {
    const r = await service.buscar('Casino');

    expect(r).toEqual({ gifs: [], blocked: true });
    expect(giphy.buscar).not.toHaveBeenCalled();
  });

  it('descarta los resultados cuyo título o descripción tiene un término bloqueado', async () => {
    giphy.buscar.mockResolvedValue([
      gif('a', 'Happy dance'),
      gif('b', 'Slot Machine Win'),
      gif('c', 'Celebrate', ['make-it-rain-money-abc']),
      gif('d', 'Abrazo fuerte'),
    ]);

    const r = await service.buscar('ganar');

    expect(r.blocked).toBe(false);
    expect(r.gifs.map((g) => g.id)).toEqual(['a', 'd']);
  });

  it('sin texto pide los GIFs del momento', async () => {
    await service.buscar('  ', 24);
    expect(giphy.buscar).toHaveBeenCalledWith('', 24, expect.any(Number));
  });

  it('al enviar, un GIF que no pasa el filtro se rechaza', async () => {
    giphy.porId.mockResolvedValue(gif('x', 'Roulette spin'));
    await expect(service.resolver('x')).rejects.toThrow(BadRequestException);
  });

  it('al enviar, un id que GIPHY no conoce se rechaza', async () => {
    giphy.porId.mockResolvedValue(null);
    await expect(service.resolver('noexiste')).rejects.toThrow(BadRequestException);
  });

  it('sin API key responde 503 en vez de fallar a medias', async () => {
    giphy.activo = false;
    await expect(service.buscar('abrazo')).rejects.toThrow(ServiceUnavailableException);
    await expect(service.resolver('a')).rejects.toThrow(ServiceUnavailableException);
  });

  it('si GIPHY se cae, responde 503', async () => {
    giphy.buscar.mockRejectedValue(new Error('GIPHY respondió 500'));
    await expect(service.buscar('abrazo')).rejects.toThrow(ServiceUnavailableException);
  });
});
