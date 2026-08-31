import { daysAgoInChile, todayInChile } from './chile-date';

describe('todayInChile', () => {
  it('devuelve el día local, no el UTC, después de las 20:00 en Chile', () => {
    // 2026-08-30 21:00 en Chile (UTC-4) = 2026-08-31 01:00 UTC.
    // En UTC el día ya cambió; para el paciente sigue siendo el 30.
    expect(todayInChile(new Date('2026-08-31T01:00:00Z'))).toBe('2026-08-30');
  });

  it('avanza de día recién a la medianoche local', () => {
    expect(todayInChile(new Date('2026-08-31T03:59:00Z'))).toBe('2026-08-30');
    expect(todayInChile(new Date('2026-08-31T04:00:00Z'))).toBe('2026-08-31');
  });

  it('respeta el horario de verano sin configurarlo a mano', () => {
    // En enero Chile está en UTC-3, así que la medianoche local cae a las 03:00 UTC
    // y no a las 04:00 como en invierno.
    expect(todayInChile(new Date('2027-01-15T02:59:00Z'))).toBe('2027-01-14');
    expect(todayInChile(new Date('2027-01-15T03:00:00Z'))).toBe('2027-01-15');
  });

  it('devuelve el formato YYYY-MM-DD que espera la columna date', () => {
    expect(todayInChile()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('daysAgoInChile', () => {
  it('resta días de calendario chilenos', () => {
    expect(daysAgoInChile(1, new Date('2026-08-31T01:00:00Z'))).toBe('2026-08-29');
    expect(daysAgoInChile(30, new Date('2026-08-31T01:00:00Z'))).toBe('2026-07-31');
  });

  it('con 0 días equivale a hoy', () => {
    const now = new Date('2026-08-31T01:00:00Z');
    expect(daysAgoInChile(0, now)).toBe(todayInChile(now));
  });
});
