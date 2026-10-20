import type { TriggerCategory } from '@stopbet/shared-types';

// El orden importa: ante un empate de coincidencias gana la categoría que aparece primero.
const CATALOG: { category: Exclude<TriggerCategory, 'other'>; pattern: RegExp }[] = [
  { category: 'money', pattern: /\b(sueldo|plata|dinero|deudas?|pago|pagaron|finiquito|aguinaldo|prestamo|cobr\w*)\b/g },
  { category: 'temptation', pattern: /\b(anuncio\w*|publicidad|casino\w*|bono\w*|promo\w*|tragamonedas?|maquinita\w*|slots?|ruleta|poker|app de apuestas)\b/g },
  { category: 'sports', pattern: /\b(partido\w*|futbol|liga|mundial|clasico|champions|apuestas? deportivas?)\b/g },
  { category: 'emotions', pattern: /\b(ansiedad|ansios\w*|estres\w*|angustia\w*|rabia|enojad\w*|triste\w*|deprimid\w*|nervios\w*)\b/g },
  { category: 'loneliness', pattern: /\b(sol[oa]|soledad|aburrid\w*|aburrimiento|nadie|aislad\w*)\b/g },
  { category: 'family', pattern: /\b(pareja|pelea\w*|pelee|discusion\w*|discuti\w*|mi senora|mi esposa?|mi marido|mi familia|mis? hijos?|separacion|divorcio)\b/g },
  { category: 'work', pattern: /\b(trabajo|pega|jefe\w*|despid\w*|cesante|oficina|turno)\b/g },
];

export const TRIGGER_CATEGORIES: TriggerCategory[] = [...CATALOG.map((c) => c.category), 'other'];

// En el celular se escribe sin tildes, y `\b` de JS no trata las vocales acentuadas como letra.
function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function classifyTrigger(text: string): TriggerCategory {
  const t = normalize(text);
  let best: TriggerCategory = 'other';
  let bestCount = 0;
  for (const { category, pattern } of CATALOG) {
    const count = t.match(pattern)?.length ?? 0;
    if (count > bestCount) {
      best = category;
      bestCount = count;
    }
  }
  return best;
}

export function isTriggerCategory(value: unknown): value is TriggerCategory {
  return typeof value === 'string' && (TRIGGER_CATEGORIES as string[]).includes(value);
}
