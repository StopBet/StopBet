import EventSource from 'react-native-sse';
import type { CommunityStreamEvent } from '@stopbet/shared-types';
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
): () => void {
  let fuente: EventSource | null = null;
  let cerrado = false;
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
      `${BASE_URL}/community/stream?sede=${encodeURIComponent(sede)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        // La reconexión la maneja este módulo: la de la librería no sabe pedir un token
        // nuevo, y con el token vencido reintentaría contra un 401 para siempre.
        pollingInterval: 0,
      },
    );

    fuente.addEventListener('open', () => {
      esperaMs = ESPERA_INICIAL_MS;
    });

    fuente.addEventListener('message', (evento) => {
      if (!evento.data) return;
      try {
        const datos = JSON.parse(evento.data) as CommunityStreamEvent;
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
    logInfo(`[Comunidad] stream caído, reintento en ${Math.round(esperaMs / 1000)}s`);
    reintento = setTimeout(() => {
      reintento = null;
      conectar();
    }, esperaMs);
    // Espera creciente: si el backend está caído, no se le insiste cada segundo.
    esperaMs = Math.min(esperaMs * 2, ESPERA_MÁXIMA_MS);
  };

  const cerrarFuente = () => {
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
