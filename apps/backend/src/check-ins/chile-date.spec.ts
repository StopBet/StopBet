import { todayInChile } from './chile-date';

describe('todayInChile', () => {
  it('devuelve el día local, no el UTC, después de las 20:00 en Chile', () => {
    // 2026-08-18 23:30 en Chile (UTC-4) = 2026-08-19 03:30 UTC.
    // En UTC el día ya cambió; para el paciente sigue siendo el 18.
    expect(todayInChile(new Date('2026-08-19T03:30:00Z'))).toBe('2026-08-18');
  });

  it('coincide con UTC cuando aún no cruzó la medianoche local', () => {
    expect(todayInChile(new Date('2026-08-18T15:00:00Z'))).toBe('2026-08-18');
  });

  it('avanza de día a la medianoche local', () => {
    // 2026-08-19 00:30 en Chile = 04:30 UTC
    expect(todayInChile(new Date('2026-08-19T04:30:00Z'))).toBe('2026-08-19');
  });

  it('devuelve el formato YYYY-MM-DD que espera la columna date', () => {
    expect(todayInChile()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
