/**
 * Lo que no puede aparecer en el buscador de GIFs. StopBet es una app para dejar de apostar: un
 * GIF de tragamonedas o de una lluvia de billetes en la comunidad es un detonante, no un chiste.
 *
 * Se compara **palabra por palabra** y no por pedazos de texto, porque si no «dados» bloquearía
 * «cuidados» y «bet» bloquearía «alphabet». Tres formas de entrada:
 * - `palabra`: solo esa palabra exacta.
 * - `raiz*`: cualquier palabra que empiece así (`apost*` cubre apostar, aposté y apostando).
 * - `*pedazo*`: cualquier palabra que lo contenga. Es para las marcas, que pegan «bet» o
 *   «casino» a otra cosa (1xbet, melbet, 888casino, pokerstars): como palabra completa se
 *   escapaban. Lo que lo contiene sin ser apuestas va en `EXCEPCIONES`.
 * - `dos palabras`: esa secuencia exacta.
 *
 * Va en español y en inglés porque GIPHY indexa sobre todo en inglés. Todo se escribe ya
 * normalizado (sin tildes, en minúsculas). Es preferible bloquear de más: un «you bet!»
 * inocente que no aparece no le hace daño a nadie.
 */
export const TERMINOS_BLOQUEADOS: readonly string[] = [
  // Dentro de cualquier palabra: cubre las casas que no están nombradas abajo
  '*bet*', '*casino*', '*poker*', '*jackpot*', '*gambl*', '*tragamoneda*',
  // Apostar
  'apuesta*', 'apost*', 'wager*',
  'sportsbook', 'bookie*', 'bookmaker*', 'parlay',
  'apuestas deportivas',
  // Casino y juegos de azar
  'tragaperra*', 'maquinita*', 'slot', 'slots', 'slot machine',
  'ruleta*', 'roulette', 'poquer', 'blackjack', 'black jack', 'baccarat', 'bacara',
  'craps', 'dados', 'dice', 'bingo*', 'pozo acumulado',
  'loteria*', 'lottery', 'lotto', 'loto', 'kino', 'raspe',
  'raspa y gana', 'scratch card', 'scratch off', 'fichas',
  // Plata fácil
  'ganar plata', 'ganar dinero', 'plata facil', 'dinero facil', 'lluvia de billetes',
  'money', 'cash', 'dinero', 'billete*', 'make it rain', 'money rain', 'win money',
  'easy money', 'get rich',
  // Casas de apuestas y casinos conocidos que no llevan «bet» ni «casino» en el nombre (las
  // que sí, como 1xbet, 22bet, melbet, mostbet, betano o jugabet, ya caen arriba)
  'parimatch', '1win', 'bwin', 'pin up', 'pinup', 'stake', 'codere', 'caliente', 'leovegas',
  'winamax', 'draftkings', 'fanduel', 'bovada', 'casumo', 'mr green', 'william hill',
  'ladbrokes', 'megapari', 'rollbit', 'duelbits', 'bc game', 'bcgame', 'wplay', '888',
  'caesars', 'monticello', 'marina del sol', 'polla',
];

/**
 * Palabras que contienen un `*pedazo*` sin tener que ver con apuestas. Sin esto, «better
 * together» o «diabetes» quedaban bloqueadas. Se comparan ya normalizadas y enteras.
 */
const EXCEPCIONES: ReadonlySet<string> = new Set([
  'better', 'between', 'beta', 'betas', 'betty', 'betsy', 'beto', 'betito', 'betis',
  'betta', 'betray', 'betrayal', 'betrayed', 'bethlehem', 'elizabeth', 'tibet', 'sorbet',
  'sorbete', 'alphabet', 'alphabets', 'alfabeto', 'analfabeto', 'abeto', 'abetos', 'diabetes',
  'diabetico', 'diabetica', 'betarraga', 'betarragas', 'betun', 'alfabetico', 'alfabetica',
]);

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
  contenido: boolean;
}

const TERMINOS: Termino[] = TERMINOS_BLOQUEADOS.map((t) => ({
  palabras: t.replace(/^\*|\*$/g, '').split(' '),
  contenido: t.startsWith('*') && t.endsWith('*'),
  prefijo: !t.startsWith('*') && t.endsWith('*'),
}));

/** Si el texto contiene alguno de los términos bloqueados, como palabra o secuencia completa. */
export function contieneTerminoBloqueado(texto: string | null | undefined): boolean {
  if (!texto) return false;
  const palabras = normalizar(texto).split(' ');
  return TERMINOS.some((t) => apareceEn(palabras, t));
}

function apareceEn(palabras: string[], t: Termino): boolean {
  if (t.contenido) {
    const [pedazo] = t.palabras;
    return palabras.some((p) => p.includes(pedazo) && !EXCEPCIONES.has(p));
  }
  const ultima = t.palabras.length - 1;
  for (let i = 0; i + ultima < palabras.length; i++) {
    const calza = t.palabras.every((p, j) =>
      j === ultima && t.prefijo ? palabras[i + j].startsWith(p) : palabras[i + j] === p,
    );
    if (calza) return true;
  }
  return false;
}
