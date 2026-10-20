import { FamilyLinkStatus, FamilyLinkVerification } from './entities/family-link.entity';
import { FamilyLinkVerdict } from './entities/family-link-review.entity';

// Historial de decisiones (HDU 23 CA6) de los vínculos que deja `pnpm run seed:family`.
//
// Sin esto, esos vínculos aparecían ya «activos» pero sin ninguna decisión de psicólogo, y la
// página Familiares no tenía nada que mostrar bajo ellos: ni «Confirmado por X · fecha» ni el
// enlace «Historial». Esto los deja como si un psicólogo de la sede los hubiera revisado.

/** Los psicólogos del seed principal (`src/seed.ts`), por correo. */
export const PSICOLOGOS_DEMO = {
  miguel: 'miguel.lara@ajuter.cl', // Santiago y Viña del Mar
  valentina: 'valentina.rojas@ajuter.cl', // solo Santiago
  tomas: 'tomas.herrera@ajuter.cl', // solo Viña del Mar
} as const;

export type PsicologoDemo = keyof typeof PSICOLOGOS_DEMO;

export interface DecisionDemo {
  verdict: FamilyLinkVerdict;
  by: PsicologoDemo;
  /** Hace cuántas horas se tomó. Relativo a hoy para que el historial nunca quede en el futuro. */
  hoursAgo: number;
  /** Solo en las confirmaciones. */
  verification?: FamilyLinkVerification;
}

const DIA = 24;

/**
 * Decisiones por familiar, de la más vieja a la más nueva. Cada familiar del seed tiene un solo
 * vínculo, así que la clave es el id del familiar.
 */
export function historialDemo(ids: {
  activo: string;
  remoto: string;
  extras: readonly string[];
}): Record<string, DecisionDemo[]> {
  const [marcela, jorge, carmen, tomas, ruth] = ids.extras;
  return {
    // Patricia → Carlos: el paciente confirmó desde la app y la psicóloga lo dejó registrado.
    [ids.activo]: [{ verdict: 'confirmed', by: 'valentina', hoursAgo: 12 * DIA, verification: 'patient_consulted' }],
    // Elena → Ignacio, en otra sede: lo revisó el psicólogo de esa sede.
    [ids.remoto]: [{ verdict: 'confirmed', by: 'tomas', hoursAgo: 10 * DIA, verification: 'in_person' }],
    [marcela]: [{ verdict: 'confirmed', by: 'valentina', hoursAgo: 9 * DIA, verification: 'in_person' }],
    // Jorge → Carlos: el caso largo, para que el «Historial» muestre una línea de tiempo real.
    // Se confirmó, se revocó, se devolvió a revisión y se volvió a confirmar.
    [jorge]: [
      { verdict: 'confirmed', by: 'valentina', hoursAgo: 8 * DIA, verification: 'in_person' },
      { verdict: 'revoked', by: 'miguel', hoursAgo: 5 * DIA },
      { verdict: 'reopened', by: 'valentina', hoursAgo: 3 * DIA },
      { verdict: 'confirmed', by: 'valentina', hoursAgo: 2 * DIA, verification: 'in_person' },
    ],
    [carmen]: [{ verdict: 'confirmed', by: 'miguel', hoursAgo: 7 * DIA, verification: 'in_person' }],
    [tomas]: [{ verdict: 'confirmed', by: 'valentina', hoursAgo: 6 * DIA, verification: 'in_person' }],
    [ruth]: [{ verdict: 'confirmed', by: 'miguel', hoursAgo: 4 * DIA, verification: 'in_person' }],
  };
}

const SIGUIENTE: Record<FamilyLinkVerdict, FamilyLinkStatus> = {
  confirmed: 'active',
  rejected: 'rejected',
  revoked: 'revoked',
  reopened: 'pending',
};

// Qué decisión se puede tomar desde cada estado (la misma máquina que `FamilyService.applyVerdict`).
const DESDE: Record<FamilyLinkStatus, FamilyLinkVerdict[]> = {
  pending: ['confirmed', 'rejected'],
  active: ['revoked'],
  rejected: [],
  revoked: ['reopened'],
};

/**
 * Estado en el que deja el vínculo una secuencia de decisiones, partiendo de «pendiente».
 * Lanza si alguna no se podría haber tomado desde el estado anterior: un historial inventado
 * que el sistema nunca habría producido no sirve para demostrar nada.
 */
export function estadoFinal(decisiones: DecisionDemo[]): FamilyLinkStatus {
  let estado: FamilyLinkStatus = 'pending';
  for (const d of decisiones) {
    if (!DESDE[estado].includes(d.verdict)) {
      throw new Error(`«${d.verdict}» no se puede tomar desde «${estado}»`);
    }
    estado = SIGUIENTE[d.verdict];
  }
  return estado;
}
