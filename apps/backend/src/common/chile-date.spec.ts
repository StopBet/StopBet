import { chileWallClockToDate, daysAgoInChile, todayInChile } from './chile-date';

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

describe('chileWallClockToDate', () => {
  // El caso medido en el sandbox de Transbank: 19:27 en Chile (UTC-3 en octubre) llegó como 19:27Z.
  it('en octubre (UTC-3) la hora de pared de Chile se corre +3 h para llegar a UTC', () => {
    expect(chileWallClockToDate('2026-10-07T19:27:52.253Z')?.toISOString()).toBe('2026-10-07T22:27:52.253Z');
  });

  it('en invierno (UTC-4) se corre +4 h', () => {
    expect(chileWallClockToDate('2026-07-07T19:00:00.000Z')?.toISOString()).toBe('2026-07-07T23:00:00.000Z');
  });

  it('sin milisegundos también funciona', () => {
    expect(chileWallClockToDate('2026-10-07T19:27:52Z')?.toISOString()).toBe('2026-10-07T22:27:52.000Z');
  });

  it('respeta el cambio de horario: el 6 de septiembre de 2026 pasa de UTC-4 a UTC-3', () => {
    expect(chileWallClockToDate('2026-09-05T12:00:00Z')?.toISOString()).toBe('2026-09-05T16:00:00.000Z');
    expect(chileWallClockToDate('2026-09-07T12:00:00Z')?.toISOString()).toBe('2026-09-07T15:00:00.000Z');
  });

  it('un texto que no es una fecha devuelve null', () => {
    expect(chileWallClockToDate('ayer')).toBeNull();
    expect(chileWallClockToDate('')).toBeNull();
  });
});
