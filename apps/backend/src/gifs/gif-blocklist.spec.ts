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
    // Marcas que pegan «bet» o «casino» a otra cosa: como palabra completa se escapaban.
    '1xbet',
    '1XBET bonus',
    '22bet',
    'melbet',
    'mostbet',
    'rojabet',
    'sportingbet',
    'Bet',
    '888casino',
    'PokerStars',
    'ggpoker',
    // Las que no dicen «bet» ni «casino»
    'parimatch',
    '1win',
    'Pin-Up',
    'leovegas',
    'Marina del Sol',
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
    // Contienen «bet» sin tener que ver con apuestas
    'diabetes',
    'betarraga',
    'Beto',
    'alfabeto',
    'between friends',
    'Elizabeth',
  ])('deja pasar «%s»', (texto) => {
    expect(contieneTerminoBloqueado(texto)).toBe(false);
  });

  it('un texto vacío o ausente no está bloqueado', () => {
    expect(contieneTerminoBloqueado('')).toBe(false);
    expect(contieneTerminoBloqueado(null)).toBe(false);
    expect(contieneTerminoBloqueado(undefined)).toBe(false);
  });
});
