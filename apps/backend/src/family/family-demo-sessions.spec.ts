import { User } from '../users/entities/user.entity';
import { Sede } from '../sedes/entities/sede.entity';
import { FamilySession } from './entities/family-session.entity';
import { SessionAttendance } from './entities/session-attendance.entity';
import {
  DEMO_PATIENT_ID,
  FAMILY_ACTIVE_ID,
  FAMILY_DEMO_SESSIONS,
  SESSION_FAR_ID,
  SESSION_PAST_ID,
  SESSION_SOON_ID,
  chileDateAt,
  ensureFamilyDemoSessions,
} from './family-demo-sessions';

const DAY = 86_400_000;
const NOW = new Date('2026-09-25T15:00:00Z');

/** Una base mínima en memoria: lo justo que usa ensureFamilyDemoSessions. */
function fakeManager(opts: { users?: Array<Partial<User>>; sessions?: Array<Partial<FamilySession>> } = {}) {
  const tables = new Map<unknown, Array<Record<string, unknown>>>([
    [User, (opts.users ?? []) as Array<Record<string, unknown>>],
    [Sede, [
      { id: 'sede-stgo', name: 'Santiago', address: 'Av. Providencia 123' },
      { id: 'sede-vina', name: 'Viña del Mar', address: 'Calle Valparaíso 45' },
    ]],
    [FamilySession, (opts.sessions ?? []) as Array<Record<string, unknown>>],
    [SessionAttendance, []],
  ]);
  const matches = (row: Record<string, unknown>, where: Record<string, unknown>) =>
    Object.entries(where).every(([k, v]) => row[k] === v);
  const manager = {
    getRepository: (entity: unknown) => {
      const rows = tables.get(entity)!;
      return {
        find: async () => rows,
        findOne: async ({ where }: { where: Record<string, unknown> }) => rows.find((r) => matches(r, where)) ?? null,
        exist: async ({ where }: { where: Record<string, unknown> }) => rows.some((r) => matches(r, where)),
        create: (data: Record<string, unknown>) => ({ ...data }),
        save: async (row: Record<string, unknown>) => {
          if (!rows.includes(row)) rows.push(row);
          return row;
        },
      };
    },
  };
  return { manager: manager as never, tables };
}

const carlos = { id: DEMO_PATIENT_ID, sedeId: 'Santiago' };

describe('chileDateAt', () => {
  it('da la hora de Chile y no la del servidor', () => {
    // 25-09 está en horario de verano de Chile (UTC-3): las 19:00 de allá son las 22:00 UTC.
    expect(chileDateAt(2, 19, NOW).toISOString()).toBe('2026-09-27T22:00:00.000Z');
  });

  it('respeta el horario de invierno (UTC-4)', () => {
    expect(chileDateAt(0, 19, new Date('2026-06-10T15:00:00Z')).toISOString()).toBe('2026-06-10T23:00:00.000Z');
  });
});

describe('ensureFamilyDemoSessions', () => {
  it('no hace nada sin Carlos Demo en la base', async () => {
    const { manager, tables } = fakeManager();
    const r = await ensureFamilyDemoSessions(manager, { resetDates: false, now: NOW });
    expect(r.skipped).toMatch(/paciente demo/);
    expect(tables.get(FamilySession)).toHaveLength(0);
  });

  it('crea al menos 5 sesiones próximas en la sede de Carlos, dentro de las 4 semanas', async () => {
    const { manager, tables } = fakeManager({ users: [carlos] });
    await ensureFamilyDemoSessions(manager, { resetDates: false, now: NOW });

    const sesiones = tables.get(FamilySession) as unknown as FamilySession[];
    expect(sesiones).toHaveLength(FAMILY_DEMO_SESSIONS.length);
    const proximas = sesiones.filter(
      (s) => s.sedeId === 'Santiago' && s.sessionDate > NOW && s.sessionDate.getTime() < NOW.getTime() + 28 * DAY,
    );
    expect(proximas.length).toBeGreaterThanOrEqual(5);
  });

  it('guarda el sedeId tal como lo tiene el paciente, y la lejana en la otra sede', async () => {
    const { manager, tables } = fakeManager({ users: [carlos] });
    await ensureFamilyDemoSessions(manager, { resetDates: false, now: NOW });

    const sesiones = tables.get(FamilySession) as unknown as FamilySession[];
    expect(sesiones.find((s) => s.id === SESSION_SOON_ID)!.sedeId).toBe('Santiago');
    expect(sesiones.find((s) => s.id === SESSION_FAR_ID)!.sedeId).toBe('sede-vina');
  });

  it('mueve las próximas que ya pasaron, pero no toca las vigentes ni la pasada a propósito', async () => {
    const vieja = new Date(NOW.getTime() - 20 * DAY);
    const vigente = new Date(NOW.getTime() + 3 * DAY);
    const { manager, tables } = fakeManager({
      users: [carlos],
      sessions: [
        { id: SESSION_SOON_ID, sessionDate: vieja, sedeId: 'Santiago' },
        { id: SESSION_FAR_ID, sessionDate: vigente, sedeId: 'sede-vina' },
        { id: SESSION_PAST_ID, sessionDate: vieja, sedeId: 'Santiago' },
      ],
    });

    const r = await ensureFamilyDemoSessions(manager, { resetDates: false, now: NOW });

    const byId = (id: string) => (tables.get(FamilySession) as unknown as FamilySession[]).find((s) => s.id === id)!;
    expect(byId(SESSION_SOON_ID).sessionDate > NOW).toBe(true);
    expect(byId(SESSION_FAR_ID).sessionDate).toBe(vigente);
    expect(byId(SESSION_PAST_ID).sessionDate).toBe(vieja);
    expect(r.moved).toHaveLength(1);
  });

  it('es idempotente: la segunda vuelta no crea ni responde nada', async () => {
    const { manager } = fakeManager({ users: [carlos, { id: FAMILY_ACTIVE_ID }] });
    const primera = await ensureFamilyDemoSessions(manager, { resetDates: false, now: NOW });
    const segunda = await ensureFamilyDemoSessions(manager, { resetDates: false, now: NOW });

    expect(primera.answers).toBe(1);
    expect(segunda).toEqual({ created: [], moved: [], answers: 0 });
  });

  it('solo responde por los familiares que existen', async () => {
    const { manager, tables } = fakeManager({ users: [carlos] });
    await ensureFamilyDemoSessions(manager, { resetDates: false, now: NOW });
    expect(tables.get(SessionAttendance)).toHaveLength(0);
  });
});
