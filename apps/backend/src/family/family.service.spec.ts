import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { FamilyService } from './family.service';
import { FamilyLink } from './entities/family-link.entity';
import { User } from '../users/entities/user.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { Sede } from '../sedes/entities/sede.entity';
import { PsychologistSede } from '../psychologists/entities/psychologist-sede.entity';
import { FamilyLinkReview } from './entities/family-link-review.entity';

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
  let reviewRepo: { create: jest.Mock; save: jest.Mock; find: jest.Mock };
  let push: { enviarAUsuarios: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let invoiceRepo: { find: jest.Mock; findOne: jest.Mock };

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
    invoiceRepo = { find: jest.fn().mockResolvedValue([]), findOne: jest.fn().mockResolvedValue(null) };
    userRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((v) => v),
      save: jest.fn((v) => Promise.resolve({ id: 'fam-new', ...v })),
    };
    notifRepo = { create: jest.fn((v) => v), save: jest.fn().mockResolvedValue(undefined) };
    sedeRepo = { findOne: jest.fn() };
    psychSedeRepo = { find: jest.fn().mockResolvedValue([]) };
    reviewRepo = {
      create: jest.fn((v) => v),
      save: jest.fn((v) => Promise.resolve(v)),
      find: jest.fn().mockResolvedValue([]),
    };
    push = { enviarAUsuarios: jest.fn().mockResolvedValue(1) };

    const manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === FamilyLink) return linkRepo;
        if (entity === User) return userRepo;
        if (entity === Notification) return notifRepo;
        if (entity === Sede) return sedeRepo;
        if (entity === PsychologistSede) return psychSedeRepo;
        if (entity === FamilyLinkReview) return reviewRepo;
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
      invoiceRepo as any,
      dataSource as any,
      push as any,
      reviewRepo as any,
    );
  });

  // ── CA 11.6 ───────────────────────────────────────────────────────────────

  it('CA 11.6: sin vínculo devuelve unlinked, no un error', async () => {
    linkRepo.find.mockResolvedValue([]);

    const view = await service.getSessionsForFamily(FAMILY_ID);

    expect(view.linkStatus).toBe('unlinked');
    expect(view.sessions).toEqual([]);
    expect(view.hasUpcoming).toBe(false);
  });

  it('CA 11.6: vínculo pendiente devuelve pending sin listar sesiones', async () => {
    linkRepo.find.mockResolvedValue([{ status: 'pending', patientUser: { sedeId: SEDE } }]);

    const view = await service.getSessionsForFamily(FAMILY_ID);

    expect(view.linkStatus).toBe('pending');
    expect(sessionRepo.find).not.toHaveBeenCalled();
  });

  // ── CA 11.1 y 11.5 ────────────────────────────────────────────────────────

  it('CA 11.1: pide las sesiones de la sede del paciente vinculado', async () => {
    linkRepo.find.mockResolvedValue([{ status: 'active', patientUser: { sedeId: SEDE } }]);

    await service.getSessionsForFamily(FAMILY_ID);

    expect(sessionRepo.find.mock.calls[0][0].where.sedeId).toBe(SEDE);
    expect(sessionRepo.find.mock.calls[0][0].order).toEqual({ sessionDate: 'ASC' });
  });

  it('CA 11.1: marca userAttends según lo ya respondido y null si no respondió', async () => {
    linkRepo.find.mockResolvedValue([{ status: 'active', patientUser: { sedeId: SEDE } }]);
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
    linkRepo.find.mockResolvedValue([{ status: 'active', patientUser: { sedeId: SEDE } }]);
    sessionRepo.find.mockResolvedValue([{ id: 's1', sessionDate: daysFromNow(45) }]);

    const view = await service.getSessionsForFamily(FAMILY_ID);

    expect(view.hasUpcoming).toBe(false);
    expect(view.sessions).toHaveLength(1);
  });

  it('CA 11.5: hasUpcoming es true con una sesión dentro de las 4 semanas', async () => {
    linkRepo.find.mockResolvedValue([{ status: 'active', patientUser: { sedeId: SEDE } }]);
    sessionRepo.find.mockResolvedValue([
      { id: 's1', sessionDate: daysFromNow(3) },
      { id: 's2', sessionDate: daysFromNow(60) },
    ]);

    expect((await service.getSessionsForFamily(FAMILY_ID)).hasUpcoming).toBe(true);
  });

  // Postgres no garantiza orden sin ORDER BY: con un vínculo rechazado y otro activo, el portal
  // podía mostrar "rechazado" a quien sí tiene acceso.
  it('con varios vínculos manda el activo aunque haya uno rechazado más reciente', async () => {
    linkRepo.find.mockResolvedValue([
      { status: 'rejected', patientUser: null },
      { status: 'active', patientUser: { sedeId: SEDE } },
    ]);

    expect(await service.getLinkStatus(FAMILY_ID)).toEqual({ status: 'active' });
  });

  it('entre vínculos sin acceso manda el más reciente', async () => {
    linkRepo.find.mockResolvedValue([
      { status: 'revoked', patientUser: { sedeId: SEDE } },
      { status: 'rejected', patientUser: null },
    ]);

    expect(await service.getLinkStatus(FAMILY_ID)).toEqual({ status: 'revoked' });
    expect(linkRepo.find.mock.calls[0][0].order).toEqual({ createdAt: 'DESC' });
  });

  // ── CA 11.4 ───────────────────────────────────────────────────────────────

  describe('confirmAttendance', () => {
    const activeLink = { status: 'active', patientUser: { sedeId: SEDE_UUID } };

    it('CA 11.4: responder dos veces actualiza la respuesta en vez de duplicarla', async () => {
      linkRepo.find.mockResolvedValue([activeLink]);
      sessionRepo.findOne.mockResolvedValue({ id: 's1', sedeId: SEDE_UUID });
      attendanceRepo.findOne.mockResolvedValue({ id: 'a1', sessionId: 's1', confirmed: true });

      const saved = await service.confirmAttendance(FAMILY_ID, 's1', { confirmed: false });

      expect(attendanceRepo.create).not.toHaveBeenCalled();
      expect(saved.confirmed).toBe(false);
    });

    it('CA 11.4: falla si la sesión no existe', async () => {
      linkRepo.find.mockResolvedValue([activeLink]);
      sessionRepo.findOne.mockResolvedValue(null);

      await expect(service.confirmAttendance(FAMILY_ID, 'nope', { confirmed: true })).rejects.toThrow(
        'Sesión no encontrada',
      );
    });

    // HDU 23 CA5: revocar retira el acceso de inmediato, también para responder asistencia.
    it.each(['pending', 'rejected', 'revoked'])('rechaza con 403 si el vínculo está %s', async (status) => {
      linkRepo.find.mockResolvedValue([{ ...activeLink, status }]);
      sessionRepo.findOne.mockResolvedValue({ id: 's1', sedeId: SEDE_UUID });

      await expect(service.confirmAttendance(FAMILY_ID, 's1', { confirmed: true })).rejects.toThrow(
        ForbiddenException,
      );
      expect(attendanceRepo.save).not.toHaveBeenCalled();
    });

    it('rechaza con 403 si no tiene vínculo', async () => {
      linkRepo.find.mockResolvedValue([]);

      await expect(service.confirmAttendance(FAMILY_ID, 's1', { confirmed: true })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('una sesión de otra sede responde igual que una inexistente', async () => {
      linkRepo.find.mockResolvedValue([activeLink]);
      sessionRepo.findOne.mockResolvedValue({ id: 's9', sedeId: '99999999-9999-9999-9999-999999999999' });

      await expect(service.confirmAttendance(FAMILY_ID, 's9', { confirmed: true })).rejects.toThrow(
        'Sesión no encontrada',
      );
      expect(attendanceRepo.save).not.toHaveBeenCalled();
    });

    // users.sedeId puede traer el nombre ('Santiago') y la sesión el UUID de la misma sede.
    it('acepta la sesión si la sede del paciente viene por nombre y la de la sesión por UUID', async () => {
      linkRepo.find.mockResolvedValue([{ status: 'active', patientUser: { sedeId: 'Santiago' } }]);
      sessionRepo.findOne.mockResolvedValue({ id: 's1', sedeId: SEDE_UUID });
      sedeRepo.findOne.mockResolvedValue({ id: SEDE_UUID });
      attendanceRepo.findOne.mockResolvedValue(null);

      const saved = await service.confirmAttendance(FAMILY_ID, 's1', { confirmed: true });

      expect(saved).toMatchObject({ sessionId: 's1', familyUserId: FAMILY_ID, confirmed: true });
    });
  });

  const coordinator = {
    id: 'coord-1', email: 'c@stopbet.cl', role: 'coordinator' as const, firstName: 'Sofía', lastName: 'Reyes', sedeId: null,
  };
  const psychOf = (sedeUuid: string) => {
    psychSedeRepo.find.mockResolvedValue([{ psychologistId: 'psych-1', sedeId: sedeUuid }]);
    return { id: 'psych-1', email: 'p@stopbet.cl', role: 'psychologist' as const, firstName: 'Miguel', lastName: 'Lara', sedeId: null };
  };
  const OTRA_SEDE = '99999999-9999-9999-9999-999999999999';

  // Regresión: la relación familyUser trae passwordHash y el RUT ya descifrado
  // por el transformer, y esta respuesta va al dashboard del psicólogo.
  it('CA 11.4: la lista de asistencias no expone datos sensibles del familiar', async () => {
    sessionRepo.findOne.mockResolvedValue({ id: 's1', sedeId: SEDE_UUID });
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

    const [view] = await service.getAttendancesForSession('s1', coordinator);

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

  // Antes cualquier psicólogo veía quién asiste a una sesión de otra sede con solo su id.
  it('un psicólogo no ve las asistencias de una sesión de otra sede: responde como inexistente', async () => {
    sessionRepo.findOne.mockResolvedValue({ id: 's1', sedeId: OTRA_SEDE });

    await expect(service.getAttendancesForSession('s1', psychOf(SEDE_UUID))).rejects.toThrow('Sesión no encontrada');
    expect(attendanceRepo.find).not.toHaveBeenCalled();
  });

  it('un psicólogo ve las asistencias de las sesiones de su sede', async () => {
    sessionRepo.findOne.mockResolvedValue({ id: 's1', sedeId: SEDE_UUID });

    await expect(service.getAttendancesForSession('s1', psychOf(SEDE_UUID))).resolves.toEqual([]);
  });

  it('un psicólogo no puede crear sesiones en una sede que no atiende', async () => {
    const dto = { title: 'Grupo', sessionDate: '2026-10-01T19:00:00Z', location: 'Sala 2', sedeId: OTRA_SEDE };

    await expect(service.createSession(dto, psychOf(SEDE_UUID))).rejects.toThrow(
      'No puedes crear sesiones en una sede que no atiendes',
    );
    expect(sessionRepo.save).not.toHaveBeenCalled();
  });

  it('crea la sesión en su propia sede, y la coordinación en cualquiera', async () => {
    const dto = { title: 'Grupo', sessionDate: '2026-10-01T19:00:00Z', location: 'Sala 2', sedeId: SEDE_UUID };

    await service.createSession(dto, psychOf(SEDE_UUID));
    await service.createSession({ ...dto, sedeId: OTRA_SEDE }, coordinator);

    expect(sessionRepo.save).toHaveBeenCalledTimes(2);
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

  describe('requestLink', () => {
    const familyUser = { id: FAMILY_ID, firstName: 'Marta', lastName: 'Soto', email: 'marta@stopbet.cl' };

    beforeEach(() => {
      linkRepo.find.mockResolvedValue([]); // currentLinkFor: sin vínculos
    });

    // Antes respondía 404 "No existe un paciente con ese correo": servía para averiguar quién
    // se atiende en AJUTER.
    it('un correo que no es de ningún paciente recibe la misma respuesta y alerta solo a coordinación', async () => {
      userRepo.findOne
        .mockResolvedValueOnce(familyUser) // la cuenta del familiar
        .mockResolvedValueOnce(null); // paciente por correo: ninguno
      userRepo.find.mockResolvedValueOnce([{ id: 'coord-1', role: 'coordinator' }]);

      const result = await service.requestLink(FAMILY_ID, { patientEmail: 'nadie@stopbet.cl' });

      expect(result).toEqual({ status: 'pending', alreadyInReview: false });
      expect(linkRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          patientUserId: null,
          declaredPatientEmail: 'nadie@stopbet.cl',
          status: 'pending',
        }),
      );
      expect(notifRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({ userId: 'coord-1', type: 'warning' }),
      ]);
    });

    it('con el correo de un paciente crea el vínculo pendiente y avisa a su sede con destino Familiares', async () => {
      userRepo.findOne
        .mockResolvedValueOnce(familyUser)
        .mockResolvedValueOnce({ id: 'pac-1', sedeId: SEDE_UUID });
      linkRepo.findOne.mockResolvedValue(null);
      userRepo.find.mockResolvedValueOnce([{ id: 'psych-1', sedeId: null }]);
      psychSedeRepo.find.mockResolvedValue([{ sedeId: SEDE_UUID }]);

      const result = await service.requestLink(FAMILY_ID, { patientEmail: 'Carlos@StopBet.cl' });

      expect(result).toEqual({ status: 'pending', alreadyInReview: false });
      expect(userRepo.findOne.mock.calls[1][0].where.role).toBe('patient');
      expect(linkRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ patientUserId: 'pac-1', status: 'pending' }),
      );
      expect(notifRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({
          userId: 'psych-1',
          target: 'family-links',
          body: expect.stringContaining('pidió vincularse'),
        }),
      ]);
    });

    // HDU 23 CA4 — se le pregunta al paciente: en la app con el nombre, por push sin él.
    it('CA4: al declarar a un paciente existente se le consulta en la app y por un push discreto', async () => {
      userRepo.findOne
        .mockResolvedValueOnce(familyUser)
        .mockResolvedValueOnce({ id: 'pac-1', sedeId: SEDE_UUID });
      linkRepo.findOne.mockResolvedValue(null);

      await service.requestLink(FAMILY_ID, { patientEmail: 'carlos@stopbet.cl' });

      expect(notifRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'pac-1',
          target: 'family-request',
          body: expect.stringContaining('Marta Soto'),
        }),
      );
      const [ids, title, body] = push.enviarAUsuarios.mock.calls[0];
      expect(ids).toEqual(['pac-1']);
      expect(`${title} ${body}`).not.toContain('Marta');
      expect(`${title} ${body}`).not.toContain('familiar');
    });

    it('CA4: si el paciente no existe no hay nadie a quien consultar', async () => {
      userRepo.findOne.mockResolvedValueOnce(familyUser).mockResolvedValueOnce(null);
      userRepo.find.mockResolvedValueOnce([{ id: 'coord-1', role: 'coordinator' }]);

      await service.requestLink(FAMILY_ID, { patientEmail: 'nadie@stopbet.cl' });

      expect(push.enviarAUsuarios).not.toHaveBeenCalled();
    });

    it('CA4: un push que falla no rompe la solicitud', async () => {
      userRepo.findOne
        .mockResolvedValueOnce(familyUser)
        .mockResolvedValueOnce({ id: 'pac-1', sedeId: SEDE_UUID });
      linkRepo.findOne.mockResolvedValue(null);
      push.enviarAUsuarios.mockRejectedValue(new Error('firebase caído'));

      await expect(service.requestLink(FAMILY_ID, { patientEmail: 'carlos@stopbet.cl' })).resolves.toEqual({
        status: 'pending',
        alreadyInReview: false,
      });
    });

    it('un familiar revocado puede volver a pedir el vínculo: se reabre el mismo', async () => {
      linkRepo.find.mockResolvedValue([{ status: 'revoked', patientUserId: 'pac-1', declaredPatientRut: null, declaredPatientEmail: 'carlos@stopbet.cl' }]);
      userRepo.findOne
        .mockResolvedValueOnce(familyUser)
        .mockResolvedValueOnce({ id: 'pac-1', sedeId: SEDE_UUID });
      linkRepo.findOne.mockResolvedValue({ id: 'link-1', status: 'revoked' });

      const result = await service.requestLink(FAMILY_ID, { patientEmail: 'carlos@stopbet.cl' });

      expect(result).toEqual({ status: 'pending', alreadyInReview: false });
      expect(linkRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'link-1' }),
        expect.objectContaining({ status: 'pending', patientResponse: null }),
      );
    });

    it('volver a declarar a un paciente que lo rechazó reabre el mismo vínculo', async () => {
      userRepo.findOne
        .mockResolvedValueOnce(familyUser)
        .mockResolvedValueOnce({ id: 'pac-1', sedeId: SEDE_UUID });
      linkRepo.findOne.mockResolvedValue({ id: 'link-1', status: 'rejected' });

      await service.requestLink(FAMILY_ID, { patientEmail: 'carlos@stopbet.cl' });

      expect(linkRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'link-1' }),
        // La respuesta anterior del paciente era sobre otra solicitud: se le vuelve a preguntar.
        expect.objectContaining({ status: 'pending', patientResponse: null }),
      );
      expect(linkRepo.save).not.toHaveBeenCalled();
    });

    it('si ese vínculo ya estaba pendiente no avisa de nuevo', async () => {
      userRepo.findOne
        .mockResolvedValueOnce(familyUser)
        .mockResolvedValueOnce({ id: 'pac-1', sedeId: SEDE_UUID });
      linkRepo.findOne.mockResolvedValue({ id: 'link-1', status: 'pending' });
      linkRepo.update.mockResolvedValue({ affected: 0 });

      expect(await service.requestLink(FAMILY_ID, { patientEmail: 'carlos@stopbet.cl' })).toEqual({
        status: 'pending',
        alreadyInReview: false,
      });
      expect(notifRepo.save).not.toHaveBeenCalled();
    });

    // Con los dos datos es más difícil acertar a ciegas: tienen que ser del mismo paciente.
    it('RUT y correo de pacientes distintos cuentan como paciente no encontrado', async () => {
      userRepo.findOne
        .mockResolvedValueOnce(familyUser)
        .mockResolvedValueOnce({ id: 'pac-otro', sedeId: SEDE_UUID }); // por correo
      userRepo.find
        .mockResolvedValueOnce([{ id: 'pac-1', rut: '22.222.222-2', sedeId: SEDE_UUID }]) // por RUT
        .mockResolvedValueOnce([{ id: 'coord-1', role: 'coordinator' }]);

      await service.requestLink(FAMILY_ID, {
        patientRut: '22.222.222-2',
        patientEmail: 'otro@stopbet.cl',
      });

      expect(linkRepo.save).toHaveBeenCalledWith(expect.objectContaining({ patientUserId: null }));
    });

    // HDU 22 CA6 — la comparación es contra lo que el familiar declaró, no contra los pacientes:
    // da lo mismo si la declaración anterior coincidió con alguien.
    it.each([
      ['coincidió con un paciente', 'pac-1'],
      ['no coincidió con nadie', null],
    ])('CA6: reenviar la misma declaración pendiente avisa que está en revisión (%s)', async (_caso, patientUserId) => {
      linkRepo.find.mockResolvedValue([
        { status: 'pending', patientUserId, declaredPatientRut: '22.222.222-2', declaredPatientEmail: null },
      ]);

      const result = await service.requestLink(FAMILY_ID, { patientRut: '22222222-2' });

      expect(result).toEqual({ status: 'pending', alreadyInReview: true });
      expect(linkRepo.save).not.toHaveBeenCalled();
      expect(notifRepo.save).not.toHaveBeenCalled();
      expect(userRepo.find).not.toHaveBeenCalled(); // ni siquiera busca pacientes
    });

    it('CA6: el correo repetido se reconoce aunque cambien las mayúsculas', async () => {
      linkRepo.find.mockResolvedValue([
        { status: 'pending', patientUserId: null, declaredPatientRut: null, declaredPatientEmail: 'carlos@stopbet.cl' },
      ]);

      expect(await service.requestLink(FAMILY_ID, { patientEmail: ' Carlos@StopBet.cl ' })).toEqual({
        status: 'pending',
        alreadyInReview: true,
      });
    });

    it('CA6: una declaración rechazada no cuenta como en revisión', async () => {
      linkRepo.find.mockResolvedValue([
        { status: 'rejected', patientUserId: 'pac-1', declaredPatientRut: null, declaredPatientEmail: 'carlos@stopbet.cl' },
      ]);
      userRepo.findOne
        .mockResolvedValueOnce(familyUser)
        .mockResolvedValueOnce({ id: 'pac-1', sedeId: SEDE_UUID });
      linkRepo.findOne.mockResolvedValue({ id: 'link-1', status: 'rejected' });

      const result = await service.requestLink(FAMILY_ID, { patientEmail: 'carlos@stopbet.cl' });

      expect(result.alreadyInReview).toBe(false);
      expect(linkRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'link-1' }),
        expect.objectContaining({ status: 'pending', declaredPatientEmail: 'carlos@stopbet.cl' }),
      );
    });

    it('con un vínculo activo responde 409 sin registrar nada', async () => {
      linkRepo.find.mockResolvedValue([{ status: 'active', patientUser: { sedeId: SEDE } }]);

      await expect(
        service.requestLink(FAMILY_ID, { patientEmail: 'carlos@stopbet.cl' }),
      ).rejects.toThrow(ConflictException);
      expect(linkRepo.save).not.toHaveBeenCalled();
    });
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
        .mockResolvedValueOnce([{ id: 'pat-1', rut: '22.222.222-2', sedeId: SEDE_UUID }]) // pacientes
        .mockResolvedValueOnce([{ id: 'psych-1', sedeId: null }]); // psicólogos activos
      psychSedeRepo.find.mockResolvedValue([{ psychologistId: 'psych-1', sedeId: SEDE_UUID }]);

      const result = await service.registerFamily(baseDto);

      expect(result).toEqual({ userId: 'fam-new', status: 'pending' });
      expect(linkRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          familyUserId: 'fam-new',
          patientUserId: 'pat-1',
          declaredPatientRut: baseDto.patientRut,
          status: 'pending',
        }),
      );
      expect(notifRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({ userId: 'psych-1', type: 'info', target: 'family-links' }),
      ]);
    });

    it('CA1: también identifica al paciente por correo en vez de RUT', async () => {
      userRepo.findOne
        .mockResolvedValueOnce(null) // correo del familiar libre
        .mockResolvedValueOnce({ id: 'pat-1', sedeId: SEDE_UUID }); // paciente por correo
      userRepo.find
        .mockResolvedValueOnce([]) // cuentas existentes
        .mockResolvedValueOnce([]); // psicólogos activos

      const result = await service.registerFamily({
        ...baseDto,
        patientRut: undefined,
        patientEmail: 'carlos@stopbet.cl',
      });

      expect(result).toEqual({ userId: 'fam-new', status: 'pending' });
      expect(linkRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ patientUserId: 'pat-1', declaredPatientEmail: 'carlos@stopbet.cl' }),
      );
    });

    // Avisa exactamente a quienes después verán el pendiente en /family/pending: antes, con un
    // psicólogo en psychologist_sedes y otro solo con sede legada, el segundo no recibía aviso.
    it('CA1: en una sede mixta avisa también al psicólogo con sede legada, y a nadie de otra sede', async () => {
      userRepo.findOne.mockResolvedValue(null);
      userRepo.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'pat-1', rut: '22.222.222-2', sedeId: SEDE_UUID }])
        .mockResolvedValueOnce([
          { id: 'psych-1', sedeId: null },
          { id: 'psych-legado', sedeId: 'Santiago' },
          { id: 'psych-otro', sedeId: null },
        ]);
      psychSedeRepo.find.mockImplementation(({ where }: { where: { psychologistId: string } }) => {
        if (where.psychologistId === 'psych-1') return Promise.resolve([{ sedeId: SEDE_UUID }]);
        if (where.psychologistId === 'psych-otro') return Promise.resolve([{ sedeId: 'sede-concepcion' }]);
        return Promise.resolve([]);
      });
      sedeRepo.findOne.mockResolvedValue({ id: SEDE_UUID });

      await service.registerFamily(baseDto);

      const notified = notifRepo.save.mock.calls[0][0].map((n: { userId: string }) => n.userId);
      expect(notified).toEqual(['psych-1', 'psych-legado']);
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
    type Reviewer = {
      id: string;
      email: string;
      role: 'psychologist' | 'coordinator';
      firstName: string;
      lastName: string;
      sedeId: string | null;
    };

    const psychologist = (over: Partial<Reviewer> = {}) => ({
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

    it('listRevokedLinks pide los vínculos revocados de la sede', async () => {
      linkRepo.find.mockResolvedValue([]);
      psychSedeRepo.find.mockResolvedValue([{ psychologistId: 'psych-1', sedeId: SEDE_UUID }]);

      await service.listRevokedLinks(psychologist());

      expect(linkRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'revoked' }) }),
      );
    });

    // ── HDU 23 CA6: ver quién decidió ─────────────────────────────────────────

    it('CA6: cada vínculo trae quién lo revisó por última vez y cuándo, con una sola consulta de nombres', async () => {
      linkRepo.find.mockResolvedValue([
        linkRow({ id: 'l1', status: 'active', reviewedBy: 'psych-1', reviewedAt: new Date('2026-10-02T14:05:00Z') }),
        linkRow({ id: 'l2', status: 'active', reviewedBy: 'psych-1', reviewedAt: new Date('2026-10-03T10:00:00Z') }),
      ]);
      psychSedeRepo.find.mockResolvedValue([{ psychologistId: 'psych-1', sedeId: SEDE_UUID }]);
      userRepo.find.mockResolvedValue([{ id: 'psych-1', firstName: 'Miguel', lastName: 'Lara' }]);

      const result = await service.listActiveLinks(psychologist());

      expect(result[0]).toMatchObject({ lastReviewedByName: 'Miguel Lara', lastReviewedAt: '2026-10-02T14:05:00.000Z' });
      expect(result[1].lastReviewedByName).toBe('Miguel Lara');
      expect(userRepo.find).toHaveBeenCalledTimes(1);
    });

    it('CA6: un vínculo que nunca se revisó no trae autor ni fecha, y no consulta nombres', async () => {
      linkRepo.find.mockResolvedValue([linkRow()]);
      psychSedeRepo.find.mockResolvedValue([{ psychologistId: 'psych-1', sedeId: SEDE_UUID }]);

      const [item] = await service.listPendingLinks(psychologist());

      expect(item.lastReviewedAt).toBeNull();
      expect(item.lastReviewedByName).toBeNull();
      expect(userRepo.find).not.toHaveBeenCalled();
    });

    it('CA6: si el autor ya no existe, el nombre queda en null en vez de romper la lista', async () => {
      linkRepo.find.mockResolvedValue([
        linkRow({ status: 'rejected', reviewedBy: 'psych-borrado', reviewedAt: new Date('2026-10-02') }),
      ]);
      psychSedeRepo.find.mockResolvedValue([{ psychologistId: 'psych-1', sedeId: SEDE_UUID }]);
      userRepo.find.mockResolvedValue([]);

      const [item] = await service.listRejectedLinks(psychologist());

      expect(item.lastReviewedByName).toBeNull();
      expect(item.lastReviewedAt).not.toBeNull();
    });

    it('CA6: listRejectedLinks pide los vínculos rechazados y respeta la sede', async () => {
      linkRepo.find.mockResolvedValue([linkRow({ status: 'rejected' })]);
      psychSedeRepo.find.mockResolvedValue([{ psychologistId: 'psych-otro', sedeId: 'sede-concepcion' }]);

      const result = await service.listRejectedLinks(psychologist());

      expect(linkRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'rejected' }) }),
      );
      expect(result).toEqual([]);
    });

    describe('getLinkHistory (CA6)', () => {
      const review = (over: Record<string, unknown> = {}) => ({
        id: 'r1',
        linkId: 'link-1',
        verdict: 'confirmed',
        reviewedBy: 'psych-1',
        verification: 'in_person',
        reviewedAt: new Date('2026-10-02T14:05:00Z'),
        ...over,
      });

      it('devuelve las decisiones con el nombre de quien las tomó, pidiendo la más nueva primero', async () => {
        linkRepo.findOne.mockResolvedValue(linkRow());
        psychSedeRepo.find.mockResolvedValue([{ psychologistId: 'psych-1', sedeId: SEDE_UUID }]);
        reviewRepo.find.mockResolvedValue([
          review({ id: 'r2', verdict: 'revoked', verification: null, reviewedBy: 'psych-2', reviewedAt: new Date('2026-10-05T09:00:00Z') }),
          review(),
        ]);
        userRepo.find.mockResolvedValue([
          { id: 'psych-1', firstName: 'Miguel', lastName: 'Lara' },
          { id: 'psych-2', firstName: 'Sofia', lastName: 'Ruiz' },
        ]);

        const result = await service.getLinkHistory('link-1', psychologist());

        expect(reviewRepo.find).toHaveBeenCalledWith({ where: { linkId: 'link-1' }, order: { reviewedAt: 'DESC' } });
        expect(result).toEqual([
          { id: 'r2', verdict: 'revoked', reviewedAt: '2026-10-05T09:00:00.000Z', reviewedByName: 'Sofia Ruiz', verification: null },
          { id: 'r1', verdict: 'confirmed', reviewedAt: '2026-10-02T14:05:00.000Z', reviewedByName: 'Miguel Lara', verification: 'in_person' },
        ]);
        expect(userRepo.find).toHaveBeenCalledTimes(1);
      });

      it('un vínculo que nunca se revisó devuelve una lista vacía', async () => {
        linkRepo.findOne.mockResolvedValue(linkRow());
        psychSedeRepo.find.mockResolvedValue([{ psychologistId: 'psych-1', sedeId: SEDE_UUID }]);

        expect(await service.getLinkHistory('link-1', psychologist())).toEqual([]);
        expect(userRepo.find).not.toHaveBeenCalled();
      });

      it('404 si el vínculo no existe', async () => {
        linkRepo.findOne.mockResolvedValue(null);

        await expect(service.getLinkHistory('nada', psychologist())).rejects.toThrow(NotFoundException);
      });

      it('404 si el vínculo no tiene paciente identificado (nunca es visible para un psicólogo)', async () => {
        linkRepo.findOne.mockResolvedValue(linkRow({ patientUser: null }));

        await expect(service.getLinkHistory('link-1', psychologist())).rejects.toThrow(NotFoundException);
        expect(reviewRepo.find).not.toHaveBeenCalled();
      });

      it('403 si el psicólogo no atiende la sede del paciente, sin leer el historial', async () => {
        linkRepo.findOne.mockResolvedValue(linkRow());
        psychSedeRepo.find.mockResolvedValue([{ psychologistId: 'psych-1', sedeId: 'sede-concepcion' }]);

        await expect(service.getLinkHistory('link-1', psychologist())).rejects.toThrow(ForbiddenException);
        expect(reviewRepo.find).not.toHaveBeenCalled();
      });

      it('el coordinador puede ver el historial de cualquier sede', async () => {
        linkRepo.findOne.mockResolvedValue(linkRow());

        await service.getLinkHistory('link-1', psychologist({ role: 'coordinator', sedeId: null }));

        expect(reviewRepo.find).toHaveBeenCalled();
      });
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

      await service.confirmLink('link-1', psychologist(), 'in_person');

      expect(linkRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'link-1', status: 'pending' }),
        expect.objectContaining({ status: 'active', reviewedBy: 'psych-1', verification: 'in_person' }),
      );
      expect(notifRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({ userId: 'fam-1', type: 'success' }),
        expect.objectContaining({ userId: 'pat-1', type: 'info' }),
      ]);
    });

    it('rechaza con 409 si el vínculo ya fue procesado (doble confirmación)', async () => {
      linkRepo.findOne.mockResolvedValue(linkRow());
      linkRepo.update.mockResolvedValue({ affected: 0 });

      await expect(service.confirmLink('link-1', psychologist(), 'in_person')).rejects.toThrow(ConflictException);
      expect(notifRepo.save).not.toHaveBeenCalled();
      expect(reviewRepo.save).not.toHaveBeenCalled();
    });

    // CA6 — cada decisión deja su fila; reviewedBy en family_links solo guarda la última.
    it.each([
      ['confirm', 'pending', 'confirmed', 'patient_consulted'],
      ['reject', 'pending', 'rejected', null],
      ['revoke', 'active', 'revoked', null],
    ] as const)('CA6: %s registra autor, veredicto y verificación en el historial', async (action, status, verdict, verification) => {
      linkRepo.findOne.mockResolvedValue(linkRow({ status, patientResponse: 'accepted' }));

      if (action === 'confirm') await service.confirmLink('link-1', psychologist(), 'patient_consulted');
      if (action === 'reject') await service.rejectLink('link-1', psychologist());
      if (action === 'revoke') await service.revokeLink('link-1', psychologist());

      expect(reviewRepo.save).toHaveBeenCalledWith({ linkId: 'link-1', verdict, reviewedBy: 'psych-1', verification });
      expect(dataSource.transaction).toHaveBeenCalled();
    });

    // CA4 — el "no" del paciente desde la app manda sobre cualquier verificación.
    it.each(['in_person', 'patient_consulted'] as const)(
      'CA4: si el paciente negó el vínculo, no se puede confirmar ni con %s',
      async (verification) => {
        linkRepo.findOne.mockResolvedValue(linkRow({ patientResponse: 'denied' }));

        await expect(service.confirmLink('link-1', psychologist(), verification)).rejects.toThrow(
          'solo puedes rechazar la solicitud',
        );
        expect(linkRepo.update).not.toHaveBeenCalled();
      },
    );

    it('CA4: "paciente consultado" exige que el paciente haya dicho que sí en la app', async () => {
      linkRepo.findOne.mockResolvedValue(linkRow({ patientResponse: null }));

      await expect(service.confirmLink('link-1', psychologist(), 'patient_consulted')).rejects.toThrow(
        'todavía no confirma el vínculo desde la app',
      );
      expect(linkRepo.update).not.toHaveBeenCalled();
    });

    it('CA4: sin respuesta del paciente se puede confirmar verificando en persona', async () => {
      linkRepo.findOne.mockResolvedValue(linkRow({ patientResponse: null }));

      await service.confirmLink('link-1', psychologist(), 'in_person');

      expect(reviewRepo.save).toHaveBeenCalledWith(expect.objectContaining({ verification: 'in_person' }));
    });

    // Si el paciente cambia a "no" entre que el psicólogo cargó la lista y confirma, el update
    // condicional no toca nada.
    it('CA4: la confirmación exige en el mismo update que el paciente siga diciendo que sí', async () => {
      linkRepo.findOne.mockResolvedValue(linkRow({ patientResponse: 'accepted' }));

      await service.confirmLink('link-1', psychologist(), 'patient_consulted');

      expect(linkRepo.update.mock.calls[0][0]).toEqual({ id: 'link-1', status: 'pending', patientResponse: 'accepted' });
    });

    // CA4 — la lista de vinculados dice cómo se verificó; en pendientes todavía no hay nada que decir.
    it('CA4: la lista de vinculados muestra cómo se verificó el vínculo', async () => {
      linkRepo.find.mockResolvedValue([
        { ...linkRow({ status: 'active', verification: 'in_person' }), familyUser: { firstName: 'Marta', lastName: 'Soto', email: 'm@x.cl' }, createdAt: new Date() },
      ]);

      const [item] = await service.listActiveLinks(psychologist());

      expect(item.verification).toBe('in_person');
    });

    it('un psicólogo de otra sede no puede confirmar', async () => {
      linkRepo.findOne.mockResolvedValue(linkRow());
      psychSedeRepo.find.mockResolvedValue([{ psychologistId: 'otro', sedeId: 'sede-concepcion' }]);

      await expect(service.confirmLink('link-1', psychologist(), 'in_person')).rejects.toThrow(
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

      await expect(service.confirmLink('no-existe', psychologist(), 'in_person')).rejects.toThrow(
        'Vínculo no encontrado',
      );
    });

    // Un revocado por error tenía que poder volver. No se restaura el acceso de golpe: vuelve a
    // pendiente y se le pregunta de nuevo al paciente, porque su respuesta anterior ya no vale.
    describe('reopenLink', () => {
      it('devuelve a pendiente, borra la respuesta anterior del paciente y lo registra en la auditoría', async () => {
        linkRepo.findOne.mockResolvedValue(linkRow({ status: 'revoked', patientResponse: 'accepted' }));

        await service.reopenLink('link-1', psychologist());

        expect(linkRepo.update).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'link-1', status: 'revoked' }),
          expect.objectContaining({ status: 'pending', reviewedBy: 'psych-1' }),
        );
        expect(linkRepo.update).toHaveBeenCalledWith(
          { id: 'link-1' },
          { patientResponse: null, patientRespondedAt: null, verification: null },
        );
        expect(reviewRepo.save).toHaveBeenCalledWith(expect.objectContaining({ verdict: 'reopened', reviewedBy: 'psych-1' }));
      });

      it('avisa al familiar y vuelve a consultar al paciente en la app y por push', async () => {
        linkRepo.findOne.mockResolvedValue(linkRow({ status: 'revoked' }));

        await service.reopenLink('link-1', psychologist());

        expect(notifRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({ userId: 'fam-1', title: 'Tu solicitud de vinculación volvió a revisión' }),
        );
        expect(notifRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({ userId: 'pat-1', target: 'family-request' }),
        );
        expect(push.enviarAUsuarios).toHaveBeenCalledWith(['pat-1'], expect.any(String), expect.any(String));
      });

      it('409 si el vínculo no está revocado', async () => {
        linkRepo.findOne.mockResolvedValue(linkRow({ status: 'active' }));
        linkRepo.update.mockResolvedValue({ affected: 0 });

        await expect(service.reopenLink('link-1', psychologist())).rejects.toThrow('El vínculo no está revocado');
        expect(push.enviarAUsuarios).not.toHaveBeenCalled();
      });

      it('un psicólogo de otra sede no puede reabrir', async () => {
        linkRepo.findOne.mockResolvedValue(linkRow({ status: 'revoked' }));
        psychSedeRepo.find.mockResolvedValue([{ psychologistId: 'otro', sedeId: 'sede-concepcion' }]);

        await expect(service.reopenLink('link-1', psychologist())).rejects.toThrow(
          'No puedes revisar vínculos de una sede que no atiendes',
        );
        expect(linkRepo.update).not.toHaveBeenCalled();
      });
    });
  });

  // ── Consulta al paciente — HDU 23 CA4 ─────────────────────────────────────

  describe('listRequestsForPatient / answerRequest', () => {
    const pendingLink = (over: Record<string, unknown> = {}) => ({
      id: 'link-1',
      familyUser: { firstName: 'Marta', lastName: 'Soto', email: 'marta@correo.cl', passwordHash: 'x', rut: '1-9' },
      patientUser: { id: 'pac-1', firstName: 'Carlos', lastName: 'Demo', sedeId: SEDE_UUID },
      patientResponse: null,
      createdAt: new Date('2026-09-28'),
      ...over,
    });

    it('lista solo las pendientes del propio paciente, sin datos sensibles del familiar', async () => {
      linkRepo.find.mockResolvedValue([pendingLink()]);

      const [req] = await service.listRequestsForPatient('pac-1');

      expect(linkRepo.find.mock.calls[0][0].where).toEqual({ patientUserId: 'pac-1', status: 'pending' });
      expect(Object.keys(req)).toEqual(['id', 'familyName', 'familyEmail', 'createdAt', 'patientResponse']);
      expect(req.familyName).toBe('Marta Soto');
    });

    it('registra la respuesta y avisa a los psicólogos de la sede', async () => {
      linkRepo.findOne.mockResolvedValue(pendingLink());
      userRepo.find.mockResolvedValueOnce([{ id: 'psych-1', sedeId: null }]);
      psychSedeRepo.find.mockResolvedValue([{ sedeId: SEDE_UUID }]);

      await service.answerRequest('pac-1', 'link-1', false);

      expect(linkRepo.findOne.mock.calls[0][0].where).toEqual({ id: 'link-1', patientUserId: 'pac-1', status: 'pending' });
      expect(linkRepo.update).toHaveBeenCalledWith(
        { id: 'link-1', status: 'pending' },
        expect.objectContaining({ patientResponse: 'denied' }),
      );
      expect(notifRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({ userId: 'psych-1', target: 'family-links', body: expect.stringContaining('no es su familiar') }),
      ]);
    });

    it('404 si la solicitud no es suya o ya la resolvió el equipo clínico', async () => {
      linkRepo.findOne.mockResolvedValue(null);

      await expect(service.answerRequest('pac-1', 'link-1', true)).rejects.toThrow('Solicitud no encontrada');
    });

    it('responder lo mismo dos veces no vuelve a avisar', async () => {
      linkRepo.findOne.mockResolvedValue(pendingLink({ patientResponse: 'accepted' }));

      await service.answerRequest('pac-1', 'link-1', true);

      expect(linkRepo.update).not.toHaveBeenCalled();
      expect(notifRepo.save).not.toHaveBeenCalled();
    });

    it('404 si el psicólogo decidió justo antes de que el paciente respondiera', async () => {
      linkRepo.findOne.mockResolvedValue(pendingLink());
      linkRepo.update.mockResolvedValue({ affected: 0 });

      await expect(service.answerRequest('pac-1', 'link-1', true)).rejects.toThrow('Solicitud no encontrada');
      expect(notifRepo.save).not.toHaveBeenCalled();
    });
  });

  // ── Mensualidad ───────────────────────────────────────────────────────────

  it('mensualidad: sin vínculo activo no expone cuotas del paciente', async () => {
    linkRepo.find.mockResolvedValue([{ status: 'pending', patientUserId: 'pat-1', patientUser: {} }]);

    const view = await service.getBillingForFamily(FAMILY_ID);

    expect(view.linkStatus).toBe('pending');
    expect(view.patientFirstName).toBeNull();
    expect(invoiceRepo.find).not.toHaveBeenCalled();
  });

  it('mensualidad: suma las cuotas vencidas y trae la próxima pendiente', async () => {
    linkRepo.find.mockResolvedValue([
      {
        status: 'active',
        patientUserId: 'pat-1',
        patientUser: { firstName: 'Lucía', accountStatus: 'suspended' },
      },
    ]);
    invoiceRepo.find.mockResolvedValue([
      { month: '2026-06', amountCLP: 30000, dueDate: '2026-06-30' },
      { month: '2026-07', amountCLP: 30000, dueDate: '2026-07-31' },
    ]);
    invoiceRepo.findOne.mockResolvedValue({ month: '2026-09', amountCLP: 30000, dueDate: '2026-09-30' });

    const view = await service.getBillingForFamily(FAMILY_ID);

    expect(invoiceRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'pat-1', status: 'overdue' } }),
    );
    expect(view).toMatchObject({
      linkStatus: 'active',
      patientFirstName: 'Lucía',
      accountStatus: 'suspended',
      totalOwedCLP: 60000,
      nextInvoice: { month: '2026-09', amountCLP: 30000, dueDate: '2026-09-30' },
    });
    expect(view.overdueInvoices).toHaveLength(2);
  });
});
