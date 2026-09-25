import { EntityManager, EntityTarget, In, Not, ObjectLiteral } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { AbstinencePeriod } from '../achievements/entities/abstinence-period.entity';
import { EarnedBadge } from '../achievements/entities/earned-badge.entity';
import { CheckIn } from '../check-ins/entities/check-in.entity';
import { AiSession } from '../ai-assistant/entities/ai-session.entity';
import { AiMessage } from '../ai-assistant/entities/ai-message.entity';
import { AiSessionSummary } from '../ai-assistant/entities/ai-session-summary.entity';
import { SponsorAssignment } from '../panic/entities/sponsor-assignment.entity';
import { PanicAlert } from '../panic/entities/panic-alert.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { Invoice } from '../billing/entities/invoice.entity';
import { PatientAssignment } from '../psychologists/entities/patient-assignment.entity';
import { ClinicalRecord } from '../clinical-records/entities/clinical-record.entity';
import { ClinicalNote } from '../clinical-records/entities/clinical-note.entity';
import { todayInChile } from '../common/chile-date';

export interface DemoPatientProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  rut: string;
  phone: string;
  birthDate: string;
}

// Copias de Carlos Demo para que varias personas prueben la app a la vez sin pisarse. Misma
// clave que el resto de las cuentas del seed. Los RUT son válidos (dígito verificador calculado).
export const EXTRA_DEMO_PATIENTS: DemoPatientProfile[] = [
  {
    id: '11111111-1111-1111-1111-111111111102',
    email: 'demo2@stopbet.cl',
    firstName: 'Martina',
    lastName: 'Demo',
    rut: '13.456.789-9',
    phone: '+56912345602',
    birthDate: '1993-07-21',
  },
  {
    id: '11111111-1111-1111-1111-111111111103',
    email: 'demo3@stopbet.cl',
    firstName: 'Diego',
    lastName: 'Demo',
    rut: '14.567.890-0',
    phone: '+56912345603',
    birthDate: '1990-11-02',
  },
  {
    id: '11111111-1111-1111-1111-111111111104',
    email: 'demo4@stopbet.cl',
    firstName: 'Javiera',
    lastName: 'Demo',
    rut: '15.678.901-1',
    phone: '+56912345604',
    birthDate: '1998-01-09',
  },
];

// Copia las filas de `entity` cuyo `fk` apunta a Carlos, con id nuevo y apuntando al clon.
// Devuelve el mapa id viejo → id nuevo, para las tablas que cuelgan de estas.
async function copyRows<T extends ObjectLiteral>(
  em: EntityManager,
  entity: EntityTarget<T>,
  where: Record<string, unknown>,
  change: (row: T) => Partial<T>,
): Promise<Map<string, string>> {
  const repo = em.getRepository(entity);
  const rows = await repo.find({ where: where as never });
  const ids = new Map<string, string>();
  for (const row of rows) {
    const { id, ...rest } = row as T & { id: string };
    const saved = await repo.save(repo.create({ ...rest, ...change(row) } as unknown as T));
    ids.set(id, (saved as T & { id: string }).id);
  }
  return ids;
}

/**
 * Crea al clon con todo lo que Carlos tiene hoy: racha y períodos, insignias, historial de
 * check-ins (menos el de hoy), conversaciones con el asistente, compañera de viaje, alertas
 * pasadas, notificaciones, pagos, psicólogo asignado y ficha clínica. Los mensajes del foro
 * no se copian: repetidos cuatro veces llenarían el chat de la sede.
 */
export async function cloneDemoPatient(
  em: EntityManager,
  sourceId: string,
  profile: DemoPatientProfile,
): Promise<void> {
  const userRepo = em.getRepository(User);
  const source = await userRepo.findOneOrFail({ where: { id: sourceId } });
  const { createdAt: _c, updatedAt: _u, ...base } = source as User & { updatedAt?: Date };
  await userRepo.save(userRepo.create({ ...base, ...profile }));

  const to = profile.id;
  const periods = await copyRows(em, AbstinencePeriod, { userId: sourceId }, () => ({ userId: to }));
  await copyRows(em, EarnedBadge, { userId: sourceId }, (b) => ({
    userId: to,
    periodId: periods.get(b.periodId) ?? b.periodId,
  }));
  await copyRows(em, CheckIn, { userId: sourceId, date: Not(todayInChile()) }, () => ({ userId: to }));

  const sessions = await copyRows(em, AiSession, { userId: sourceId }, () => ({ userId: to }));
  if (sessions.size > 0) {
    await copyRows(em, AiMessage, { sessionId: In([...sessions.keys()]) }, (m) => ({
      sessionId: sessions.get(m.sessionId)!,
    }));
    await copyRows(em, AiSessionSummary, { sessionId: In([...sessions.keys()]) }, (s) => ({
      sessionId: sessions.get(s.sessionId)!,
      userId: to,
    }));
  }

  await copyRows(em, SponsorAssignment, { patientId: sourceId }, () => ({ patientId: to }));
  await copyRows(
    em,
    PanicAlert,
    { patientId: sourceId, status: In(['responded', 'cancelled']) },
    () => ({ patientId: to }),
  );
  await copyRows(em, Notification, { userId: sourceId }, () => ({ userId: to }));
  await copyRows(em, Subscription, { userId: sourceId }, () => ({ userId: to }));
  await copyRows(em, Invoice, { userId: sourceId }, () => ({ userId: to }));
  await copyRows(em, PatientAssignment, { patientId: sourceId, active: true }, () => ({ patientId: to }));
  await copyRows(em, ClinicalRecord, { patientId: sourceId }, () => ({ patientId: to }));
  await copyRows(em, ClinicalNote, { patientId: sourceId }, () => ({ patientId: to }));
}
