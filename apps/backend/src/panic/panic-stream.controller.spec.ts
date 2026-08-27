import { firstValueFrom } from 'rxjs';
import { PanicStreamController } from './panic-stream.controller';
import { PanicService } from './panic.service';

// El stream emite cada 5 s con timers reales, así que se usan fake timers y se
// toma solo la primera emisión: lo que interesa es el resumen que arma, no el
// intervalo.
describe('PanicStreamController', () => {
  let controller: PanicStreamController;
  let service: { listHistory: jest.Mock };

  beforeEach(() => {
    jest.useFakeTimers();
    service = { listHistory: jest.fn() };
    controller = new PanicStreamController(service as unknown as PanicService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function primeraEmision() {
    const promesa = firstValueFrom(controller.streamAlerts());
    await jest.advanceTimersByTimeAsync(5_000);
    return promesa;
  }

  it('resume el total, las pendientes y la fecha de la más reciente', async () => {
    service.listHistory.mockResolvedValue([
      { status: 'pending', createdAt: '2026-06-15T12:00:00Z' },
      { status: 'responded', createdAt: '2026-06-14T12:00:00Z' },
      { status: 'pending', createdAt: '2026-06-13T12:00:00Z' },
    ]);

    const evento = await primeraEmision();

    expect(evento.data).toEqual({
      count: 3,
      pendingCount: 2,
      latestCreatedAt: '2026-06-15T12:00:00Z',
    });
  });

  it('sin alertas devuelve ceros y fecha nula, no revienta', async () => {
    service.listHistory.mockResolvedValue([]);

    const evento = await primeraEmision();

    expect(evento.data).toEqual({ count: 0, pendingCount: 0, latestCreatedAt: null });
  });

  it('no cuenta como pendientes las alertas ya cerradas', async () => {
    service.listHistory.mockResolvedValue([
      { status: 'cancelled', createdAt: '2026-06-15T12:00:00Z' },
      { status: 'escalated', createdAt: '2026-06-14T12:00:00Z' },
    ]);

    const evento = await primeraEmision();

    expect((evento.data as { pendingCount: number }).pendingCount).toBe(0);
  });
});
