import type { BadgeMilestone } from '@stopbet/shared-types';
import type { IconName } from '../components/Icon';

export interface BadgeDef {
  label: string;
  icon: IconName;
  daysLabel: string;
}

/**
 * Cada hito con su nombre y su ícono.
 *
 * Vive acá y no dentro de una pantalla porque lo usan dos: la colección de Logros y la
 * tarjeta del foro cuando alguien comparte su insignia. Si estuviera duplicado, el día que
 * cambie un ícono la comunidad mostraría uno distinto al de la insignia que celebra.
 */
export const BADGE_CONFIG: Record<BadgeMilestone, BadgeDef> = {
  1:  { label: 'Primer día',    icon: 'sprout',       daysLabel: '1 día' },
  3:  { label: 'Primeros pasos',icon: 'chart-column', daysLabel: '3 días' },
  7:  { label: 'Una semana',    icon: 'star',         daysLabel: '7 días' },
  14: { label: 'Dos semanas',   icon: 'sunrise',      daysLabel: '14 días' },
  21: { label: 'Constancia',    icon: 'flame',        daysLabel: '21 días' },
  30: { label: 'Un mes',        icon: 'medal',        daysLabel: '30 días' },
  45: { label: 'Más fuerte',    icon: 'shield',       daysLabel: '45 días' },
  60: { label: 'Dos meses',     icon: 'trophy',       daysLabel: '60 días' },
  75: { label: 'Enfoque',       icon: 'target',       daysLabel: '75 días' },
  90: { label: 'Tres meses',    icon: 'crown',        daysLabel: '90 días' },
};

/**
 * El hito que corresponde a una cantidad de días, si es uno de la colección.
 *
 * Un mensaje del foro guarda los días, no el hito: puede venir de un logro viejo migrado
 * desde el texto, así que el número podría no estar en la colección y ahí no hay insignia
 * que mostrar.
 */
export function badgeDe(días: number | null | undefined): BadgeDef | null {
  if (!días) return null;
  return BADGE_CONFIG[días as BadgeMilestone] ?? null;
}
