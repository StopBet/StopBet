import { ConflictException } from '@nestjs/common';
import { FamilyService } from './family.service';
import { FamilyLink } from './entities/family-link.entity';
import { User } from '../users/entities/user.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { Sede } from '../sedes/entities/sede.entity';
import { PsychologistSede } from '../psychologists/entities/psychologist-sede.entity';

const FAMILY_ID = 'fam-1';
const SEDE = 'sede-santiago';
const SEDE_UUID = '11111111-1111-1111-1111-111111111111';

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

describe('FamilyService (HU-11)', () => {
  let service: FamilyService;
  let linkRepo: { findOne: jest.Mock; find: jest.Mock; create: jest.Mock; save: jest.Mock; update: jest.Mock };
  let sessionRepo: { find: jest.Mock; findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let attendanceRepo: { find: jest.Mock; findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let userRepo: { findOne: jest.Mock; find: jest.Mock; create: jest.Mock; save: jest.Mock };
  let notifRepo: { create: jest.Mock; save: jest.Mock };
  let sedeRepo: { findOne: jest.Mock };
  let psychSedeRepo: { find: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  beforeEach(() => {
    linkRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((v) => v),
      save: jest.fn((v) => Promise.resolve(v)),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
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
    userRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((v) => v),
      save: jest.fn((v) => Promise.resolve({ id: 'fam-new', ...v })),
    };
    notifRepo = { create: jest.fn((v) => v), save: jest.fn().mockResolvedValue(undefined) };
    sedeRepo = { findOne: jest.fn() };
    psychSedeRepo = { find: jest.fn().mockResolvedValue([]) };

    const manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === FamilyLink) return linkRepo;
        if (entity === User) return userRepo;
        if (entity === Notification) return notifRepo;
        if (entity === Sede) return sedeRepo;
        if (entity === PsychologistSede) return psychSedeRepo;
        throw new Error('Entidad sin mock en el spec');
      }),
    };
    dataSource = {
      transaction: jest.fn(async (run: (m: unknown) => Promise<unknown>) => run(manager)),
    };

    service = new FamilyService(
      linkRepo as any,
      sessionRepo as any,
      attendanceRepo as any,
      userRepo as any,
      notifRepo as any,
      sedeRepo as any,
      psychSedeRepo as any,
      dataSource as any,
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

  // ── registerFamily — HDU 22 ─────────────────────────────────────────────────

  describe('registerFamily', () => {
    const baseDto = {
      firstName: 'Marta',
      lastName: 'Soto',
      rut: '11.111.111-1',
      email: 'marta@stopbet.cl',
      password: 'clave1234',
      patientRut: '22.222.222-2',
    };

    it('CA3: rechaza con 409 si el correo ya existe, sin crear cuenta ni vínculo', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'existing' });

      await expect(service.registerFamily(baseDto)).rejects.toThrow(ConflictException);
      expect(userRepo.save).not.toHaveBeenCalled();
      expect(linkRepo.save).not.toHaveBeenCalled();
    });

    // El RUT va cifrado con IV aleatorio: no hay columna que filtrar, así que el chequeo
    // compara en memoria contra todas las cuentas existentes.
    it('CA3: rechaza con 409 si el RUT del familiar ya existe, sin crear cuenta ni vínculo', async () => {
      userRepo.findOne.mockResolvedValue(null);
      userRepo.find.mockResolvedValueOnce([{ id: 'otro', rut: '11.111.111-1' }]);

      await expect(service.registerFamily(baseDto)).rejects.toThrow(ConflictException);
      expect(userRepo.save).not.toHaveBeenCalled();
      expect(linkRepo.save).not.toHaveBeenCalled();
    });

    it('CA1: vincula al paciente encontrado por RUT y notifica a los psicólogos de su sede', async () => {
      userRepo.findOne.mockResolvedValue(null);
      userRepo.find
        .mockResolvedValueOnce([]) // cuentas existentes (dedupe de RUT)
        .mockResolvedValueOnce([{ id: 'pat-1', rut: '22.222.222-2', sedeId: SEDE_UUID }]); // pacientes
      psychSedeRepo.find.mockResolvedValue([{ psychologistId: 'psych-1', sedeId: SEDE_UUID }]);

      const result = await service.registerFamily(baseDto);

      expect(result).toEqual({ userId: 'fam-new', status: 'pending' });
      expect(linkRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          familyUserId: 'fam-new',
          patientUserId: 'pat-1',
          declaredPatientRut: null,
          status: 'pending',
        }),
      );
      expect(notifRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({ userId: 'psych-1', type: 'info' }),
      ]);
    });

    // CA2 — ni la respuesta ni ningún psicólogo se enteran de que el RUT no coincidió: solo
    // coordinación, vía notificación, y el intento queda igual en family_links.
    it('CA2: si el RUT del paciente no corresponde a nadie, guarda el intento y alerta a coordinación con la misma respuesta', async () => {
      userRepo.findOne.mockResolvedValue(null);
      userRepo.find
        .mockResolvedValueOnce([]) // cuentas existentes
        .mockResolvedValueOnce([]) // pacientes: ninguno coincide
        .mockResolvedValueOnce([{ id: 'coord-1', role: 'coordinator' }]); // coordinadores

      const result = await service.registerFamily(baseDto);

      expect(result).toEqual({ userId: 'fam-new', status: 'pending' });
      expect(linkRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          familyUserId: 'fam-new',
          patientUserId: null,
          declaredPatientRut: baseDto.patientRut,
          status: 'pending',
        }),
      );
      expect(notifRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({ userId: 'coord-1', type: 'warning' }),
      ]);
    });
  });

  // ── Revisión del vínculo por el psicólogo — HDU 23 ──────────────────────────

  describe('listPendingLinks / listActiveLinks', () => {
    const psychologist = (over: Partial<import('@stopbet/shared-types').AuthUser> = {}) => ({
      id: 'psych-1',
      email: 'psico@stopbet.cl',
      role: 'psychologist' as const,
      firstName: 'Miguel',
      lastName: 'Lara',
      sedeId: SEDE,
      ...over,
    });

    const linkRow = (over: Record<string, unknown> = {}) => ({
      id: 'link-1',
      familyUserId: 'fam-1',
      familyUser: { firstName: 'Marta', lastName: 'Soto', email: 'marta@stopbet.cl' },
      patientUserId: 'pat-1',
      patientUser: { id: 'pat-1', firstName: 'Carlos', lastName: 'Demo', sedeId: SEDE_UUID },
      status: 'pending',
      createdAt: new Date('2026-09-01'),
      ...over,
    });

    it('CA1: solo trae vínculos con paciente identificado, de la sede del psicólogo', async () => {
      linkRepo.find.mockResolvedValue([linkRow()]);
      psychSedeRepo.find.mockResolvedValue([{ psychologistId: 'psych-1', sedeId: SEDE_UUID }]);

      const result = await service.listPendingLinks(psychologist());

      expect(linkRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'pending' }) }),
      );
      expect(result).toEqual([
        expect.objectContaining({ id: 'link-1', familyName: 'Marta Soto', patientName: 'Carlos Demo' }),
      ]);
    });

    it('un psicólogo no ve vínculos de otra sede', async () => {
      linkRepo.find.mockResolvedValue([linkRow()]);
      psychSedeRepo.find.mockResolvedValue([{ psychologistId: 'psych-otro', sedeId: 'sede-concepcion' }]);

      const result = await service.listPendingLinks(psychologist());

      expect(result).toEqual([]);
    });

    it('el coordinador ve vínculos de cualquier sede', async () => {
      linkRepo.find.mockResolvedValue([linkRow()]);

      const result = await service.listPendingLinks(
        psychologist({ role: 'coordinator', sedeId: null }),
      );

      expect(result).toHaveLength(1);
      expect(psychSedeRepo.find).not.toHaveBeenCalled();
    });

    it('listActiveLinks pide los vínculos en estado active, no pending', async () => {
      linkRepo.find.mockResolvedValue([]);
      psychSedeRepo.find.mockResolvedValue([{ psychologistId: 'psych-1', sedeId: SEDE_UUID }]);

      await service.listActiveLinks(psychologist());

      expect(linkRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'active' }) }),
      );
    });
  });

  describe('confirmLink / rejectLink / revokeLink', () => {
    const psychologist = (over: Record<string, unknown> = {}) => ({
      id: 'psych-1',
      email: 'psico@stopbet.cl',
      role: 'psychologist' as const,
      firstName: 'Miguel',
      lastName: 'Lara',
      sedeId: SEDE,
      ...over,
    });

    const linkRow = (over: Record<string, unknown> = {}) => ({
      id: 'link-1',
      familyUserId: 'fam-1',
      familyUser: { firstName: 'Marta', lastName: 'Soto' },
      patientUserId: 'pat-1',
      patientUser: { id: 'pat-1', firstName: 'Carlos', lastName: 'Demo', sedeId: SEDE_UUID },
      status: 'pending',
      ...over,
    });

    beforeEach(() => {
      psychSedeRepo.find.mockResolvedValue([{ psychologistId: 'psych-1', sedeId: SEDE_UUID }]);
    });

    it('CA2: confirma el vínculo y notifica al familiar y al paciente', async () => {
      linkRepo.findOne.mockResolvedValue(linkRow());

      await service.confirmLink('link-1', psychologist());

      expect(linkRepo.update).toHaveBeenCalledWith(
        { id: 'link-1', status: 'pending' },
        expect.objectContaining({ status: 'active', reviewedBy: 'psych-1' }),
      );
      expect(notifRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({ userId: 'fam-1', type: 'success' }),
        expect.objectContaining({ userId: 'pat-1', type: 'info' }),
      ]);
    });

    it('rechaza con 409 si el vínculo ya fue procesado (doble confirmación)', async () => {
      linkRepo.findOne.mockResolvedValue(linkRow());
      linkRepo.update.mockResolvedValue({ affected: 0 });

      await expect(service.confirmLink('link-1', psychologist())).rejects.toThrow(ConflictException);
      expect(notifRepo.save).not.toHaveBeenCalled();
    });

    it('un psicólogo de otra sede no puede confirmar', async () => {
      linkRepo.findOne.mockResolvedValue(linkRow());
      psychSedeRepo.find.mockResolvedValue([{ psychologistId: 'otro', sedeId: 'sede-concepcion' }]);

      await expect(service.confirmLink('link-1', psychologist())).rejects.toThrow(
        'No puedes revisar vínculos de una sede que no atiendes',
      );
      expect(linkRepo.update).not.toHaveBeenCalled();
    });

    it('CA3: rechaza el vínculo y notifica solo al familiar, no al paciente', async () => {
      linkRepo.findOne.mockResolvedValue(linkRow());

      await service.rejectLink('link-1', psychologist());

      expect(linkRepo.update).toHaveBeenCalledWith(
        { id: 'link-1', status: 'pending' },
        expect.objectContaining({ status: 'rejected' }),
      );
      expect(notifRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'fam-1', type: 'warning' }),
      );
      expect(notifRepo.save).not.toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ userId: 'pat-1' }),
      ]));
    });

    it('CA5: revoca un vínculo activo y notifica a ambas partes', async () => {
      linkRepo.findOne.mockResolvedValue(linkRow({ status: 'active' }));

      await service.revokeLink('link-1', psychologist());

      expect(linkRepo.update).toHaveBeenCalledWith(
        { id: 'link-1', status: 'active' },
        expect.objectContaining({ status: 'revoked', reviewedBy: 'psych-1' }),
      );
      expect(notifRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({ userId: 'fam-1', type: 'warning' }),
        expect.objectContaining({ userId: 'pat-1', type: 'info' }),
      ]);
    });

    it('no se puede revocar un vínculo que no está activo', async () => {
      linkRepo.findOne.mockResolvedValue(linkRow({ status: 'pending' }));
      linkRepo.update.mockResolvedValue({ affected: 0 });

      await expect(service.revokeLink('link-1', psychologist())).rejects.toThrow(ConflictException);
    });

    it('404 si el vínculo no existe', async () => {
      linkRepo.findOne.mockResolvedValue(null);

      await expect(service.confirmLink('no-existe', psychologist())).rejects.toThrow(
        'Vínculo no encontrado',
      );
    });
  });
});
