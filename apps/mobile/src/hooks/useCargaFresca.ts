import { useCallback, useRef } from 'react';

/** Cuánto vale lo que ya está en pantalla antes de volver a pedirlo. */
export const FRESCURA_MS = 30_000;

/**
 * Envuelve una carga para que **no se repita si acaba de ocurrir**.
 *
 * Las secciones viven en un pager: cambiar de pestaña es un gesto, no una decisión, así que
 * ir a Perfil y volver disparaba otra vez todas las peticiones de la pantalla aunque hubieran
 * pasado dos segundos. Con esto, lo que ya está a la vista se queda y el sondeo sigue
 * encargándose de refrescar.
 *
 * `forzar` salta la guarda: es lo que usa el gesto de tirar para actualizar, donde el paciente
 * está pidiendo datos nuevos de forma explícita.
 */
export function useCargaFresca(
  cargar: (esRefresco?: boolean) => Promise<void> | void,
  frescuraMs: number = FRESCURA_MS,
): (opciones?: { forzar?: boolean; esRefresco?: boolean }) => Promise<void> {
  const última = useRef(0);

  return useCallback(
    async ({ forzar = false, esRefresco = false } = {}) => {
      const ahora = Date.now();
      if (!forzar && ahora - última.current < frescuraMs) return;
      última.current = ahora;
      try {
        await cargar(esRefresco);
      } catch {
        // Que un fallo no cuente como carga buena: si no, la pantalla se queda vacía
        // hasta que pase la ventana de frescura.
        última.current = 0;
      }
    },
    [cargar, frescuraMs],
  );
}
