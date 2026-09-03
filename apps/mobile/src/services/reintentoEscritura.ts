import { isNetworkError } from './checkInQueue';

// El teléfono puede enviar una escritura, el servidor procesarla y responder bien, y
// aun así la respuesta no volver: el cliente recibe `TypeError: Network request failed`
// a los ~200 ms mientras en el servidor quedó un 201. Medido contra Railway el
// 2026-09-02: POST /check-ins respondió 201 en 64 ms y el teléfono lo dio por caído.
//
// Reintentar es seguro porque el backend ya distingue el duplicado: el check-in
// responde 409 y el pánico reutiliza la alerta abierta. Un 409 tras un fallo de red
// no es un error — es la confirmación de que la primera sí llegó.
const INTENTOS = 3;
const ESPERA_MS = 400;

const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Devuelve true si el error es un conflicto: el servidor ya tenía el dato. */
export function esConflicto(err: unknown): boolean {
  return ((err as Error)?.message ?? '').startsWith('409');
}

/**
 * Ejecuta una escritura reintentando solo ante fallos de red.
 *
 * Si un reintento devuelve 409, se entiende que el intento anterior sí llegó y se
 * resuelve con `null`: la escritura está hecha, aunque esta llamada no traiga cuerpo.
 * Cualquier otro error se propaga sin reintentar — un 400 o un 403 no mejoran
 * repitiendo la petición.
 */
export async function conReintento<T>(operacion: () => Promise<T>): Promise<T | null> {
  let ultimo: unknown;
  for (let intento = 1; intento <= INTENTOS; intento++) {
    try {
      return await operacion();
    } catch (err) {
      // El 409 solo cuenta como éxito si antes hubo un fallo de red: sin eso es un
      // duplicado legítimo que la pantalla debe seguir informando.
      if (esConflicto(err) && intento > 1) return null;
      if (!isNetworkError(err)) throw err;
      ultimo = err;
      if (intento < INTENTOS) await dormir(ESPERA_MS * intento);
    }
  }
  throw ultimo;
}
