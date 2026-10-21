import EventSource from 'react-native-sse';
import type { CommunityStreamEvent, DirectStreamEvent } from '@stopbet/shared-types';
import { BASE_URL, refrescarSesión } from './api';
import { session } from './session';
import { logInfo } from '../utils/log';

/**
 * Los mensajes del foro de una sede, en vivo.
 *
 * El servidor **empuja** el mensaje ya armado: no hay sondeo ni de un lado ni del otro. La
 * alternativa era preguntar cada pocos segundos, que con una sede activa son cientos de
 * consultas por minuto contra la base para casi siempre responder "nada nuevo".
 *
 * Se usa `react-native-sse` y no el `EventSource` del navegador porque este último no puede
 * mandar cabeceras, y el stream exige `Authorization`.
 */
export function abrirStreamDeComunidad(
  sede: string,
  onEvento: (evento: CommunityStreamEvent) => void,
  alReconectar?: () => void,
): () => void {
  return abrirStream(`/community/stream?sede=${encodeURIComponent(sede)}`, onEvento, alReconectar);
}

/**
 * Los mensajes directos propios, en vivo: los que llegan y los que uno manda desde otro
 * teléfono. El servidor filtra por la sesión, así que no hace falta decir de quién.
 */
export function abrirStreamDeMensajes(
  onEvento: (evento: DirectStreamEvent) => void,
  alReconectar?: () => void,
): () => void {
  return abrirStream('/messages/stream', onEvento, alReconectar);
}

/**
 * `alReconectar` corre cada vez que la conexión vuelve tras caerse (no en la primera). El
 * servidor no guarda lo que emitió mientras uno no estaba: lo que se escribió durante el
 * corte (wifi que se va, pantalla bloqueada, redeploy de Railway) solo aparece si la
 * pantalla lo vuelve a pedir.
 */
function abrirStream<E extends { kind: string }>(
  ruta: string,
  onEvento: (evento: E) => void,
  alReconectar?: () => void,
): () => void {
  let fuente: EventSource | null = null;
  let cerrado = false;
  let yaConectó = false;
  let vigilante: ReturnType<typeof setTimeout> | null = null;

  // Una conexión puede morir sin que llegue ningún error: al cambiar de wifi a datos, o si el
  // servidor se reinicia, Android a veces la deja colgada y la pantalla queda sorda sin
  // aviso. El servidor manda un latido cada 25 s; si pasa más que eso sin oír nada, la
  // conexión se da por muerta y se abre otra.
  const vigilar = () => {
    if (vigilante) clearTimeout(vigilante);
    vigilante = setTimeout(() => {
      vigilante = null;
      logInfo(`[Stream ${ruta.split('?')[0]}] sin latido, se reconecta`);
      cerrarFuente();
      programarReintento();
    }, SILENCIO_MÁXIMO_MS);
  };
  let reintento: ReturnType<typeof setTimeout> | null = null;
  let esperaMs = ESPERA_INICIAL_MS;

  const conectar = () => {
    if (cerrado) return;
    const token = session.getAccessToken();
    if (!token) {
      // Sin sesión no hay a qué conectarse; se vuelve a intentar por si está por llegar.
      programarReintento();
      return;
    }

    fuente = new EventSource(
      `${BASE_URL}${ruta}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        // La reconexión la maneja este módulo: la de la librería no sabe pedir un token
        // nuevo, y con el token vencido reintentaría contra un 401 para siempre.
        pollingInterval: 0,
      },
    );
    vigilar();

    fuente.addEventListener('open', () => {
      vigilar();
      esperaMs = ESPERA_INICIAL_MS;
      if (yaConectó) alReconectar?.();
      yaConectó = true;
    });

    fuente.addEventListener('message', (evento) => {
      vigilar();
      if (!evento.data) return;
      try {
        const datos = JSON.parse(evento.data) as E;
        // El latido solo mantiene viva la conexión.
        if (datos.kind === 'ping') return;
        onEvento(datos);
      } catch {
        // Un evento ilegible no puede tumbar la conexión.
      }
    });

    fuente.addEventListener('error', () => {
      cerrarFuente();
      if (cerrado) return;
      // El motivo más común de caída es el token vencido: se renueva antes de reintentar.
      void refrescarSesión().finally(programarReintento);
    });
  };

  const programarReintento = () => {
    if (cerrado || reintento) return;
    logInfo(`[Stream ${ruta.split('?')[0]}] caído, reintento en ${Math.round(esperaMs / 1000)}s`);
    reintento = setTimeout(() => {
      reintento = null;
      conectar();
    }, esperaMs);
    // Espera creciente: si el backend está caído, no se le insiste cada segundo.
    esperaMs = Math.min(esperaMs * 2, ESPERA_MÁXIMA_MS);
  };

  const cerrarFuente = () => {
    if (vigilante) clearTimeout(vigilante);
    vigilante = null;
    fuente?.removeAllEventListeners();
    fuente?.close();
    fuente = null;
  };

  conectar();

  return () => {
    cerrado = true;
    if (reintento) clearTimeout(reintento);
    cerrarFuente();
  };
}

const ESPERA_INICIAL_MS = 2_000;
const ESPERA_MÁXIMA_MS = 60_000;
// Dos latidos del servidor (25 s) y algo de margen.
const SILENCIO_MÁXIMO_MS = 60_000;
