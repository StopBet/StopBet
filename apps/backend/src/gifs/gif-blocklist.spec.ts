import { contieneTerminoBloqueado, normalizar } from './gif-blocklist';

describe('gif-blocklist', () => {
  it('normaliza tildes, mayúsculas y signos', () => {
    expect(normalizar('¡Lotería!  Máquina-Tragamonedas')).toBe('loteria maquina tragamonedas');
  });

  it.each([
    'casino',
    'Casinos online',
    'Apuestas deportivas',
    'apostar',
    'aposté todo',
    'TRAGAMONEDAS',
    'slot machine win',
    'Happy Slot Machine GIF by Vegas',
    'ruleta',
    'póker',
    'Lotería',
    'money rain',
    'lluvia de billetes',
    'make-it-rain',
    'bet365',
    'jackpot!!!',
  ])('bloquea «%s»', (texto) => {
    expect(contieneTerminoBloqueado(texto)).toBe(true);
  });

  it.each([
    'gracias',
    'abrazo',
    'buenos días',
    'cuidados',
    'alphabet',
    'better together',
    'betty boop',
    'estamos contigo',
    'good luck',
    'fuerza',
    'me han dado ánimo',
  ])('deja pasar «%s»', (texto) => {
    expect(contieneTerminoBloqueado(texto)).toBe(false);
  });

  it('un texto vacío o ausente no está bloqueado', () => {
    expect(contieneTerminoBloqueado('')).toBe(false);
    expect(contieneTerminoBloqueado(null)).toBe(false);
    expect(contieneTerminoBloqueado(undefined)).toBe(false);
  });
});
