import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * Un `setInterval` que **se detiene cuando la app pasa a segundo plano** y vuelve al frente
 * con una ejecución inmediata.
 *
 * Un `setInterval` normal sigue disparando con la pantalla apagada y el teléfono en el
 * bolsillo: son peticiones que nadie va a ver, pagadas con la batería y los datos del
 * paciente. Al volver, además, lo que se muestra está viejo justo en el momento en que se
 * está mirando, así que se recarga de inmediato en vez de esperar el próximo turno.
 *
 * `fn` se guarda en una ref: el intervalo no se reinicia porque el componente vuelva a
 * renderizar, y aun así siempre llama a la versión más reciente.
 */
export function useIntervaloActivo(fn: () => void, ms: number, activo = true): void {
  const guardada = useRef(fn);
  guardada.current = fn;

  useEffect(() => {
    if (!activo) return;

    let id: ReturnType<typeof setInterval> | null = null;

    const arrancar = () => {
      if (id !== null) return;
      id = setInterval(() => guardada.current(), ms);
    };
    const detener = () => {
      if (id === null) return;
      clearInterval(id);
      id = null;
    };

    if (AppState.currentState === 'active') arrancar();

    const sub = AppState.addEventListener('change', (estado: AppStateStatus) => {
      if (estado === 'active') {
        guardada.current();
        arrancar();
      } else {
        detener();
      }
    });

    return () => {
      detener();
      sub.remove();
    };
  }, [ms, activo]);
}
