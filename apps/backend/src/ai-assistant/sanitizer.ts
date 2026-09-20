// S.3 — excluye del texto que viaja al LLM lo que identifica al paciente.
// HdU13 CA6 amplía qué se omite: el criterio pide que los detonantes de la ficha personalicen
// la conversación «sin enviar nombre, RUT ni datos de contacto al modelo», y los detonantes los
// escribe el psicólogo en texto libre, donde aparecen teléfonos y nombres de terceros.

export interface DatosAOmitir {
  firstName?: string;
  lastName?: string;
  // Familiares vinculados y compañero de viaje: personas que el sistema ya tiene registradas
  // alrededor del paciente. Es una lista concreta, no un detector de nombres propios: sobre
  // texto clínico en español un detector daría falsos positivos («Santiago», «Fonasa») y
  // rompería justamente el detonante que el asistente necesita entender.
  relacionados?: string[];
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Sin `\b`: en JavaScript los acentos no cuentan como caracteres de palabra, así que
// `\bÁngel\b` no engancha nunca. Con `\p{L}` el límite respeta los acentos y, de paso, deja de
// romper «mañana» cuando la paciente se llama Ana.
function comoPalabra(nombre: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(nombre)}(?![\\p{L}\\p{N}])`, 'giu');
}

const RUT = /\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/gi;

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

// Con prefijo país en cualquiera de sus formas (+56 9 1122 3304, 0056 2 2123 4567) o el móvil
// de nueve dígitos que se anota suelto (912345678, 9 1122 3304). Pedir esos nueve dígitos
// exactos es lo que evita confundir un teléfono con un monto: «perdió 950.000 en una noche»
// no lo toca.
const TEL_PAIS = /(?<!\d)(?:\+|00)\s?56(?:[\s.\-()]*\d){8,9}/g;
const TEL_MOVIL = /(?<!\d)9[\s.\-]?\d{4}[\s.\-]?\d{4}(?!\d)/g;

export function sanitizePii(text: string, datos?: DatosAOmitir): string {
  // El correo va primero: lleva puntos y dígitos adentro, y si lo tocaran antes los patrones
  // de teléfono o RUT quedaría una dirección a medio tachar, que es peor que no tacharla.
  let sanitized = text.replace(EMAIL, '[CONTACTO OMITIDO]');

  sanitized = sanitized.replace(RUT, '[RUT OMITIDO]');
  sanitized = sanitized.replace(TEL_PAIS, '[CONTACTO OMITIDO]');
  sanitized = sanitized.replace(TEL_MOVIL, '[CONTACTO OMITIDO]');

  const nombres = [
    datos?.firstName,
    datos?.lastName,
    ...(datos?.relacionados ?? []),
  ];

  for (const nombre of nombres) {
    const limpio = nombre?.trim();
    if (limpio) sanitized = sanitized.replace(comoPalabra(limpio), '[NOMBRE OMITIDO]');
  }

  return sanitized;
}
