import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Quien activa "Quitar animaciones" en Android lo hace por vértigo, migraña o
 * sensibilidad al movimiento. La app ignoraba ese ajuste: el modal de insignia
 * lanzaba doce chispas, la cuenta reactivada dejaba un halo latiendo en bucle y
 * el asistente mostraba tres puntos saltando sin parar.
 *
 * Devuelve `true` cuando hay que reemplazar el movimiento por un fundido simple.
 */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let vigente = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => { if (vigente) setReduce(v); })
      .catch(() => {});

    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      vigente = false;
      sub.remove();
    };
  }, []);

  return reduce;
}
