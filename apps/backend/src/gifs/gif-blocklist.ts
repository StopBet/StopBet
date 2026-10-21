/**
 * Lo que no puede aparecer en el buscador de GIFs. StopBet es una app para dejar de apostar: un
 * GIF de tragamonedas o de una lluvia de billetes en la comunidad es un detonante, no un chiste.
 *
 * Se compara **palabra por palabra** y no por pedazos de texto, porque si no «dados» bloquearía
 * «cuidados» y «bet» bloquearía «alphabet». Tres formas de entrada:
 * - `palabra`: solo esa palabra exacta.
 * - `raiz*`: cualquier palabra que empiece así (`apost*` cubre apostar, aposté y apostando).
 * - `dos palabras`: esa secuencia exacta.
 *
 * Va en español y en inglés porque GIPHY indexa sobre todo en inglés. Todo se escribe ya
 * normalizado (sin tildes, en minúsculas). Es preferible bloquear de más: un «you bet!»
 * inocente que no aparece no le hace daño a nadie.
 */
export const TERMINOS_BLOQUEADOS: readonly string[] = [
  // Apostar
  'apuesta*', 'apost*', 'bet', 'bets', 'betting', 'bettor', 'wager*', 'gambl*',
  'sportsbook', 'bookie*', 'bookmaker*', 'parlay',
  'apuestas deportivas', 'sports betting',
  // Casino y juegos de azar
  'casino*', 'tragamoneda*', 'tragaperra*', 'maquinita*', 'slot', 'slots', 'slot machine',
  'ruleta*', 'roulette', 'poker', 'poquer', 'blackjack', 'black jack', 'baccarat', 'bacara',
  'craps', 'dados', 'dice', 'bingo*', 'jackpot*', 'pozo acumulado',
  'loteria*', 'lottery', 'lotto', 'loto', 'kino', 'polla chilena', 'polla gol', 'raspe',
  'raspa y gana', 'scratch card', 'scratch off', 'fichas de casino', 'poker chips',
  // Plata fácil
  'ganar plata', 'ganar dinero', 'plata facil', 'dinero facil', 'lluvia de billetes',
  'money', 'cash', 'dinero', 'billete*', 'make it rain', 'money rain', 'win money',
  'easy money', 'get rich',
  // Casas de apuestas conocidas en Chile
  'bet365', 'betano', 'betsson', 'betway', 'betfair', 'codere', 'jugabet', 'coolbet',
  'pokerstars', 'stake', 'monticello',
];

/**
 * Minúsculas, sin tildes y con todo lo que no sea letra o número convertido en espacio. La ñ
 * queda como n, igual que en los términos.
 */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

interface Termino {
  palabras: string[];
  prefijo: boolean;
}

const TERMINOS: Termino[] = TERMINOS_BLOQUEADOS.map((t) => ({
  palabras: t.replace(/\*$/, '').split(' '),
  prefijo: t.endsWith('*'),
}));

/** Si el texto contiene alguno de los términos bloqueados, como palabra o secuencia completa. */
export function contieneTerminoBloqueado(texto: string | null | undefined): boolean {
  if (!texto) return false;
  const palabras = normalizar(texto).split(' ');
  return TERMINOS.some((t) => apareceEn(palabras, t));
}

function apareceEn(palabras: string[], t: Termino): boolean {
  const ultima = t.palabras.length - 1;
  for (let i = 0; i + ultima < palabras.length; i++) {
    const calza = t.palabras.every((p, j) =>
      j === ultima && t.prefijo ? palabras[i + j].startsWith(p) : palabras[i + j] === p,
    );
    if (calza) return true;
  }
  return false;
}
