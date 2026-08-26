import { FamilyService } from './family.service';

const FAMILY_ID = 'fam-1';
const SEDE = 'sede-santiago';

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

describe('FamilyService (HU-11)', () => {
  let service: FamilyService;
  let linkRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let sessionRepo: { find: jest.Mock; findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let attendanceRepo: { find: jest.Mock; findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let userRepo: { findOne: jest.Mock };

  beforeEach(() => {
    linkRepo = { findOne: jest.fn(), create: jest.fn((v) => v), save: jest.fn((v) => Promise.resolve(v)) };
    sessionRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn((v) => v),
      save: jest.fn((v) => Promise.resolve(v)),
    };
    attendanceRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn((v) => v),
      save: jest.fn((v) => Promise.resolve(v)),
    };
    userRepo = { findOne: jest.fn() };

    service = new FamilyService(
      linkRepo as any,
      sessionRepo as any,
      attendanceRepo as any,
      userRepo as any,
    );
  });

  // ── CA 11.6 ───────────────────────────────────────────────────────────────

  it('CA 11.6: sin vínculo devuelve unlinked, no un error', async () => {
    linkRepo.findOne.mockResolvedValue(null);

    const view = await service.getSessionsForFamily(FAMILY_ID);

    expect(view.linkStatus).toBe('unlinked');
    expect(view.sessions).toEqual([]);
    expect(view.hasUpcoming).toBe(false);
  });

  it('CA 11.6: vínculo pendiente devuelve pending sin listar sesiones', async () => {
    linkRepo.findOne.mockResolvedValue({ status: 'pending', patientUser: { sedeId: SEDE } });

    const view = await service.getSessionsForFamily(FAMILY_ID);

    expect(view.linkStatus).toBe('pending');
    expect(sessionRepo.find).not.toHaveBeenCalled();
  });

  // ── CA 11.1 y 11.5 ────────────────────────────────────────────────────────

  it('CA 11.1: pide las sesiones de la sede del paciente vinculado', async () => {
    linkRepo.findOne.mockResolvedValue({ status: 'active', patientUser: { sedeId: SEDE } });

    await service.getSessionsForFamily(FAMILY_ID);

    expect(sessionRepo.find.mock.calls[0][0].where.sedeId).toBe(SEDE);
    expect(sessionRepo.find.mock.calls[0][0].order).toEqual({ sessionDate: 'ASC' });
  });

  it('CA 11.1: marca userAttends según lo ya respondido y null si no respondió', async () => {
    linkRepo.findOne.mockResolvedValue({ status: 'active', patientUser: { sedeId: SEDE } });
    sessionRepo.find.mockResolvedValue([
      { id: 's1', sessionDate: daysFromNow(2) },
      { id: 's2', sessionDate: daysFromNow(5) },
      { id: 's3', sessionDate: daysFromNow(9) },
    ]);
    attendanceRepo.find.mockResolvedValue([
      { sessionId: 's1', confirmed: true },
      { sessionId: 's2', confirmed: false },
    ]);

    const view = await service.getSessionsForFamily(FAMILY_ID);

    expect(view.sessions.map((s) => s.userAttends)).toEqual([true, false, null]);
  });

  it('CA 11.5: hasUpcoming es false si todo cae fuera de las 4 semanas', async () => {
    linkRepo.findOne.mockResolvedValue({ status: 'active', patientUser: { sedeId: SEDE } });
    sessionRepo.find.mockResolvedValue([{ id: 's1', sessionDate: daysFromNow(45) }]);

    const view = await service.getSessionsForFamily(FAMILY_ID);

    expect(view.hasUpcoming).toBe(false);
    expect(view.sessions).toHaveLength(1);
  });

  it('CA 11.5: hasUpcoming es true con una sesión dentro de las 4 semanas', async () => {
    linkRepo.findOne.mockResolvedValue({ status: 'active', patientUser: { sedeId: SEDE } });
    sessionRepo.find.mockResolvedValue([
      { id: 's1', sessionDate: daysFromNow(3) },
      { id: 's2', sessionDate: daysFromNow(60) },
    ]);

    expect((await service.getSessionsForFamily(FAMILY_ID)).hasUpcoming).toBe(true);
  });

  // ── CA 11.4 ───────────────────────────────────────────────────────────────

  it('CA 11.4: responder dos veces actualiza la respuesta en vez de duplicarla', async () => {
    sessionRepo.findOne.mockResolvedValue({ id: 's1' });
    attendanceRepo.findOne.mockResolvedValue({ id: 'a1', sessionId: 's1', confirmed: true });

    const saved = await service.confirmAttendance(FAMILY_ID, 's1', { confirmed: false });

    expect(attendanceRepo.create).not.toHaveBeenCalled();
    expect(saved.confirmed).toBe(false);
  });

  it('CA 11.4: falla si la sesión no existe', async () => {
    sessionRepo.findOne.mockResolvedValue(null);

    await expect(service.confirmAttendance(FAMILY_ID, 'nope', { confirmed: true })).rejects.toThrow(
      'Sesión no encontrada',
    );
  });

  // Regresión: la relación familyUser trae passwordHash y el RUT ya descifrado
  // por el transformer, y esta respuesta va al dashboard del psicólogo.
  it('CA 11.4: la lista de asistencias no expone datos sensibles del familiar', async () => {
    attendanceRepo.find.mockResolvedValue([
      {
        id: 'a1',
        sessionId: 's1',
        familyUserId: FAMILY_ID,
        confirmed: true,
        confirmedAt: new Date(),
        familyUser: {
          firstName: 'Patricia',
          lastName: 'Gómez',
          email: 'patricia@stopbet.cl',
          passwordHash: '$2b$10$secreto',
          rut: '12.345.678-9',
        },
      },
    ]);

    const [view] = await service.getAttendancesForSession('s1');

    expect(view.familyUserName).toBe('Patricia Gómez');
    expect(Object.keys(view)).toEqual([
      'id',
      'sessionId',
      'familyUserId',
      'familyUserName',
      'confirmed',
      'confirmedAt',
    ]);
    expect(JSON.stringify(view)).not.toContain('secreto');
    expect(JSON.stringify(view)).not.toContain('12.345.678-9');
  });

  it('CA 11.4: la vista del psicólogo cuenta confirmaciones y rechazos por sesión', async () => {
    sessionRepo.find.mockResolvedValue([{ id: 's1', title: 'Grupo', sessionDate: daysFromNow(2) }]);
    attendanceRepo.find.mockResolvedValue([
      { id: 'a1', sessionId: 's1', familyUserId: 'f1', confirmed: true, confirmedAt: new Date(), familyUser: { firstName: 'Ana', lastName: 'Pérez' } },
      { id: 'a2', sessionId: 's1', familyUserId: 'f2', confirmed: false, confirmedAt: new Date(), familyUser: { firstName: 'Luis', lastName: 'Soto' } },
      { id: 'a3', sessionId: 's1', familyUserId: 'f3', confirmed: true, confirmedAt: new Date(), familyUser: { firstName: 'Eva', lastName: 'Ruiz' } },
    ]);

    const [session] = await service.getSedeSessions(SEDE);

    expect(session.confirmedCount).toBe(2);
    expect(session.declinedCount).toBe(1);
    expect(session.attendances).toHaveLength(3);
  });

  it('CA 11.4: sin sesiones en la sede no consulta asistencias', async () => {
    sessionRepo.find.mockResolvedValue([]);

    expect(await service.getSedeSessions(SEDE)).toEqual([]);
    expect(attendanceRepo.find).not.toHaveBeenCalled();
  });

  // ── Vínculo ───────────────────────────────────────────────────────────────

  it('rechaza vincular con un correo que no es de un paciente', async () => {
    userRepo.findOne.mockResolvedValue(null);

    await expect(
      service.requestLink(FAMILY_ID, { patientEmail: 'nadie@stopbet.cl' }),
    ).rejects.toThrow('No existe un paciente con ese correo');
  });

  it('el vínculo nace en pending, nunca activo', async () => {
    userRepo.findOne.mockResolvedValue({ id: 'pac-1' });
    linkRepo.findOne.mockResolvedValue(null);

    const link = await service.requestLink(FAMILY_ID, { patientEmail: 'carlos@stopbet.cl' });

    expect(link.status).toBe('pending');
  });

  it('no permite vincular dos veces al mismo paciente', async () => {
    userRepo.findOne.mockResolvedValue({ id: 'pac-1' });
    linkRepo.findOne.mockResolvedValue({ id: 'link-1' });

    await expect(
      service.requestLink(FAMILY_ID, { patientEmail: 'carlos@stopbet.cl' }),
    ).rejects.toThrow('Ya existe un vínculo con ese paciente');
  });
});
