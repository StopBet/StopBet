// SPIKE 2 · CA3 — mide qué tanto cubren las listas públicas de dominios de apuestas
// la nómina oficial que Subtel ordenó bloquear en Chile.
//
// Por qué existe: las listas internacionales se arman con tráfico global, y el criterio
// que importa para StopBet es la cobertura LOCAL. Sin medirlo, elegir fuente es a ojo.
//
// Uso:
//   node scripts/spike2-cobertura-listas.mjs <carpeta-con-las-listas>
//
// Las listas se descargan aparte (son ~19 MB, no van al repo):
//   curl -L -o stevenblack.txt      https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/gambling-only/hosts
//   curl -L -o blocklistproject.txt https://raw.githubusercontent.com/blocklistproject/Lists/master/gambling.txt
//   curl -L -o hagezi.txt           https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/gambling.txt

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Nómina de Subtel del 01-09-2026 (42 dominios), validada por la Superintendencia de
// Casinos de Juego. Normalizada: sin protocolo, sin "www.", sin ruta.
const SUBTEL = [
  'lat.betano.com', 'coolbet.com', 'coolbetchile.com', '1xbet.com',
  'chile.1xbet.com', 'betsson.com', 'betsson1001.com', 'rojabet.cl',
  'rojabet.com', 'betsala.com', 'betsala11.com', 'micasino.com',
  'micasinoenvivo.com', 'jugabet.cl', 'stake.com', 'allsport365.com',
  'z2.bet365.com', '1wins.cl', 'estelarbet.cl', 'estelarbet.vip',
  'juegalo.com', 'apuestasroyal.com', 'cl.novibet.com', 'epicbet.com',
  'bc.game', 'playglobal5.com', 'rabona.com', 'rab0na-2417.com',
  'pin-up.world', 'latamwinonline.com', 'melbet.com', 'tikitaka.com',
  'tonybet.com', 'betfury.com', 'bet7k.cl', 'doradobet.com',
  'winchile.com', 'jackpotcitycasino.com', 'juegaconelking.com', 'casinonano.com',
  'nayafacil-903.com', 'betcris.com',
];

// Juego de azar LEGAL en Chile. Que aparezcan en una lista no es necesariamente un error:
// para una app de ludopatía puede ser deseable bloquearlos. Es una decisión de producto
// (CA4), y por eso se miden aparte de los falsos positivos de verdad.
const JUEGO_LEGAL = ['polla.cl', 'loteria.cl', 'teletrak.cl'];

// Si algo de acá aparece bloqueado, es un falso positivo real: rompería la navegación
// del paciente o la propia app.
const LEGITIMOS = [
  'bancoestado.cl', 'santander.cl', 'sii.cl', 'correos.cl', 'mercadolibre.cl',
  'railway.app', 'vercel.app', 'google.com', 'gmail.com', 'whatsapp.com',
];

const FUENTES = [
  { archivo: 'stevenblack.txt', nombre: 'StevenBlack (gambling-only)', licencia: 'MIT' },
  { archivo: 'blocklistproject.txt', nombre: 'The Blocklist Project', licencia: 'Unlicense/MIT' },
  { archivo: 'hagezi.txt', nombre: 'HaGeZi (gambling)', licencia: 'GPL-3.0' },
];

/** Extrae dominios de los dos formatos que usan estas listas: hosts y sintaxis adblock. */
function parsear(contenido) {
  const dominios = new Set();
  for (const cruda of contenido.split('\n')) {
    const linea = cruda.trim();
    if (!linea || linea.startsWith('#') || linea.startsWith('!') || linea.startsWith('[')) continue;

    let dominio = null;
    if (linea.startsWith('||')) {
      // Formato adblock: ||dominio.com^
      const m = linea.match(/^\|\|([^\^/$]+)\^?/);
      if (m) dominio = m[1];
    } else {
      // Formato hosts: 0.0.0.0 dominio.com
      const partes = linea.split(/\s+/);
      const candidato = partes.length > 1 ? partes[1] : partes[0];
      if (candidato && candidato.includes('.') && !candidato.includes(':')) dominio = candidato;
    }

    if (!dominio) continue;
    dominio = dominio.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
    // "0.0.0.0" y "127.0.0.1" pasan el filtro de "tiene punto": se descartan a mano.
    if (/^\d+\.\d+\.\d+\.\d+$/.test(dominio)) continue;
    if (dominio.length > 3) dominios.add(dominio);
  }
  return dominios;
}

/**
 * Un dominio está cubierto de dos formas distintas, y la diferencia importa:
 *  - exacto: la lista trae ese dominio tal cual.
 *  - por padre: la lista trae el dominio padre (ej. betano.com para lat.betano.com).
 *
 * Bloquear por padre solo funciona si NUESTRO filtro corta también los subdominios. Un
 * archivo hosts es coincidencia exacta; la sintaxis adblock (||dominio^) sí cubre
 * subdominios. Es una decisión de implementación del PoC, así que se reportan separados.
 */
function cobertura(dominio, lista) {
  if (lista.has(dominio)) return 'exacto';
  const partes = dominio.split('.');
  for (let i = 1; i < partes.length - 1; i++) {
    if (lista.has(partes.slice(i).join('.'))) return 'padre';
  }
  return 'ninguno';
}

const carpeta = process.argv[2];
if (!carpeta) {
  console.error('Falta la carpeta con las listas.\n  node scripts/spike2-cobertura-listas.mjs <carpeta>');
  process.exit(1);
}

const resultados = [];
for (const fuente of FUENTES) {
  const lista = parsear(readFileSync(join(carpeta, fuente.archivo), 'utf8'));
  const detalle = SUBTEL.map((d) => ({ dominio: d, estado: cobertura(d, lista) }));
  resultados.push({
    ...fuente,
    total: lista.size,
    exactos: detalle.filter((d) => d.estado === 'exacto').length,
    padres: detalle.filter((d) => d.estado === 'padre').length,
    faltantes: detalle.filter((d) => d.estado === 'ninguno').map((d) => d.dominio),
    juegoLegal: JUEGO_LEGAL.filter((d) => cobertura(d, lista) !== 'ninguno'),
    falsosPositivos: LEGITIMOS.filter((d) => cobertura(d, lista) !== 'ninguno'),
  });
}

const pct = (n) => `${Math.round((n / SUBTEL.length) * 100)}%`;

console.log(`\nCobertura de la nómina de Subtel (${SUBTEL.length} dominios, 01-09-2026)\n`);
console.log('| Fuente | Licencia | Entradas | Exactos | Por padre | Cubiertos | Sin cubrir |');
console.log('|---|---|---:|---:|---:|---:|---:|');
for (const r of resultados) {
  const cubiertos = r.exactos + r.padres;
  console.log(
    `| ${r.nombre} | ${r.licencia} | ${r.total.toLocaleString('es-CL')} | ${r.exactos} | ${r.padres} | ` +
    `${cubiertos} (${pct(cubiertos)}) | ${r.faltantes.length} |`,
  );
}

for (const r of resultados) {
  console.log(`\n### ${r.nombre}`);
  console.log(`Sin cubrir (${r.faltantes.length}): ${r.faltantes.join(', ') || '—'}`);
  console.log(`Juego legal en Chile que igual bloquea: ${r.juegoLegal.join(', ') || '—'}`);
  console.log(`Falsos positivos (servicios legítimos): ${r.falsosPositivos.join(', ') || '—'}`);
}

// Cuántos dominios de Subtel no cubre NINGUNA lista: es el argumento para mantener la
// nómina chilena como fuente propia además de la internacional.
const sinNadie = SUBTEL.filter((d) => resultados.every((r) => r.faltantes.includes(d)));
console.log(`\nDominios que NINGUNA lista cubre (${sinNadie.length}): ${sinNadie.join(', ') || '—'}`);
