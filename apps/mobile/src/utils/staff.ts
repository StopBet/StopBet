import type { EmotionType } from '@stopbet/shared-types';
import type { PanicStatus, StaffAlert, StaffPatient } from '../services/api';

/**
 * Los cuatro estados reales de una alerta de pánico, con el mismo criterio que el
 * dashboard web (`apps/web/src/utils/alertStatus.ts`). `escalated` **no** es una alerta
 * resuelta: el compañero de viaje no respondió a tiempo, o el paciente la escaló, y sigue
 * abierta. Traducirla como "resuelta" fue el P0 de la auditoría de la web; no se repite acá.
 */
export const ALERT_STATUS: Record<PanicStatus, { label: string; needsAttention: boolean }> = {
  pending:   { label: 'Esperando respuesta',      needsAttention: true },
  escalated: { label: 'Escalada · sin respuesta', needsAttention: true },
  responded: { label: 'Respondida',               needsAttention: false },
  cancelled: { label: 'Cerrada',                  needsAttention: false },
};

export function needsAttention(status: PanicStatus): boolean {
  return ALERT_STATUS[status].needsAttention;
}

/**
 * Se compara el día local, no el UTC: con `toISOString()` el día ya es mañana desde las
 * 20-21 h de Chile y "Alertas hoy" quedaba en 0 con alertas de esa misma tarde.
 */
export function isToday(iso: string): boolean {
  const d = new Date(iso);
  const hoy = new Date();
  return (
    d.getFullYear() === hoy.getFullYear() &&
    d.getMonth() === hoy.getMonth() &&
    d.getDate() === hoy.getDate()
  );
}

export function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  // El reloj del teléfono puede ir atrasado respecto del servidor
  if (mins < 1) return 'Recién';
  if (mins < 60) return `Hace ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  const dias = Math.floor(hrs / 24);
  if (dias < 30) return `Hace ${dias}d`;
  return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

export function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}

export function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-CL', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export const EMOTION_EMOJI: Record<string, string> = {
  tired: '😴', anxious: '😰', angry: '😡', lonely: '😔', good: '😊',
};

export const EMOTION_LABEL: Record<EmotionType, string> = {
  tired: 'Cansado', anxious: 'Ansioso', angry: 'Con rabia', lonely: 'Solo', good: 'Bien',
};

export function iniciales(p: { firstName: string; lastName: string }): string {
  return `${p.firstName[0] ?? ''}${p.lastName[0] ?? ''}`.toUpperCase();
}

export function nombreCompleto(p: { firstName: string; lastName: string }): string {
  return `${p.firstName} ${p.lastName}`.trim();
}

/** Agrupa el historial por paciente, ya ordenado de más reciente a más antiguo. */
export function alertasPorPaciente(alertas: StaffAlert[]): Record<string, StaffAlert[]> {
  const mapa: Record<string, StaffAlert[]> = {};
  for (const a of alertas) {
    (mapa[a.patientId] ??= []).push(a);
  }
  for (const id of Object.keys(mapa)) {
    mapa[id].sort((x, y) => +new Date(y.createdAt) - +new Date(x.createdAt));
  }
  return mapa;
}

/** Un paciente está en riesgo si tiene alguna alerta que todavía espera respuesta. */
export function enRiesgo(paciente: StaffPatient, porPaciente: Record<string, StaffAlert[]>): boolean {
  return (porPaciente[paciente.id] ?? []).some((a) => needsAttention(a.status));
}

/**
 * `users.sedeId` es un `varchar` y en la práctica guarda **dos cosas distintas**: las
 * cuentas del seed y las anteriores tienen el nombre ("Santiago") y las creadas desde el
 * registro tienen el UUID. `panic_alerts` no tiene sede propia: copia la del paciente, así
 * que arrastra lo mismo. Comparar solo por id dejaría fuera a media sede sin que nada lo
 * delate - la lista sale vacía, no rota, así que se aceptan las dos formas.
 *
 * No es el arreglo: el arreglo es normalizar la columna, y eso es una migración.
 */
export function mismaSede(valor: string | null, sede: { id: string; name: string }): boolean {
  return valor === sede.id || valor === sede.name;
}

/**
 * "Santiago Centro · AJUTER" no cabe en el ancho de un teléfono. Se queda con lo que
 * distingue una sede de otra, que es lo que va antes del separador.
 */
export function sedeCorta(nombre: string): string {
  return nombre.split('·')[0].trim();
}
