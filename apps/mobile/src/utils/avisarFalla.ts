import { toast } from '../context/ToastContext';
import { isNetworkError } from '../services/checkInQueue';
import { devFlags } from '../store/devFlags';
import { logWarn } from './log';

/**
 * El aviso de que algo del chat no salió. Antes cada acción decía "Sin conexión" pasara lo que
 * pasara: un 500 del servidor, el modo de prueba encendido y un corte de red real se veían
 * igual, y el error no quedaba en ningún log.
 *
 * `acción` va en infinitivo ("enviar tu mensaje") para completar "No se pudo ...".
 */
export function avisarFalla(acción: string, err: unknown): void {
  logWarn(`[Comunidad] falló ${acción}:`, err);

  if (devFlags.simulateOffline) {
    toast(`No se intentó ${acción}: tienes "Simular sin conexión" activado en Perfil.`, 'error');
    return;
  }
  if (isNetworkError(err)) {
    toast(`Sin conexión: no se pudo ${acción}. Inténtalo de nuevo.`, 'error');
    return;
  }
  // `request()` lanza "<status> <cuerpo>" ante una respuesta no OK.
  const status = parseInt((err as Error)?.message ?? '', 10);
  toast(
    Number.isFinite(status)
      ? `No se pudo ${acción}. El servidor respondió ${status}.`
      : `No se pudo ${acción}. Inténtalo de nuevo.`,
    'error',
  );
}

/** El código HTTP de un error de `request()`, si lo trae. */
export function estadoDe(err: unknown): number | null {
  const status = parseInt((err as Error)?.message ?? '', 10);
  return Number.isFinite(status) ? status : null;
}
