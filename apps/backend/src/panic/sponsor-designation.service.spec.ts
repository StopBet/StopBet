import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AuthUser } from '@stopbet/shared-types';
import { SponsorDesignationService } from './sponsor-designation.service';

// Los repos van como `any`: TypeORM's Repository tiene decenas de métodos y tiparlos
// entero para un mock de tres funciones no agrega seguridad. Mismo patrón que
// `panic.service.spec.ts`.

const PSICOLOGO: AuthUser = {
  id: 'psi-1',
  email: 'psi@stopbet.cl',
  role: 'psychologist',
  firstName: 'Ana',
  lastName: 'Soto',
  sedeId: 'sede-1',
};

const OTRO_PSICOLOGO: AuthUser = {
  ...PSICOLOGO,
  id: 'psi-2',
  firstName: 'Bruno',
  lastName: 'Lagos',
};

const COORDINADOR: AuthUser = {
  ...PSICOLOGO,
  id: 'coord-1',
  role: 'coordinator',
  sedeId: null,
};

const pacienteActivo = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  firstName: 'Carlos',
  lastName: 'Rivas',
  role: 'patient',
  accountStatus: 'active',
  sedeId: 'sede-1',
  ...over,
});

describe('SponsorDesignationService', () => {
  let service: SponsorDesignationService;
  let designationRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };
  let userRepo: { find: jest.Mock; findOne: jest.Mock };
  let assignmentRepo: {
    count: jest.Mock;
    update: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    findOne: jest.Mock;
  };
  let notificationRepo: { save: jest.Mock; create: jest.Mock };

  // El servicio consulta `userRepo.findOne` dos veces por operación: el paciente y,
  // al serializar, el psicólogo que hizo la designación. El mock responde por id.
  const directorio: Record<string, unknown> = {};
  const registrar = (...personas: Array<{ id: string }>) => {
    for (const p of personas) directorio[p.id] = p;
  };

  beforeEach(() => {
    for (const k of Object.keys(directorio)) delete directorio[k];
    registrar(PSICOLOGO, OTRO_PSICOLOGO, COORDINADOR);

    designationRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((v) =>
        Promise.resolve({
          id: 'd1',
          designatedAt: new Date('2026-09-21T12:00:00Z'),
          revokedAt: null,
          ...v,
        }),
      ),
      create: jest.fn((v) => v),
    };
    userRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(({ where }) =>
        Promise.resolve(directorio[where.id] ?? null),
      ),
    };
    assignmentRepo = {
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockResolvedValue(undefined),
      save: jest.fn((v) => Promise.resolve(v)),
      create: jest.fn((v) => v),
      findOne: jest.fn().mockResolvedValue(null),
    };
    notificationRepo = {
      save: jest.fn((v) => Promise.resolve(v)),
      create: jest.fn((v) => v),
    };

    service = new SponsorDesignationService(
      designationRepo as any,
      userRepo as any,
      assignmentRepo as any,
      notificationRepo as any,
    );
  });

  // ── CA21.2 ───────────────────────────────────────────────────────────────

  describe('listCandidates (CA21.2)', () => {
    it('pide solo pacientes activos', async () => {
      await service.listCandidates(PSICOLOGO);

      const { where } = userRepo.find.mock.calls[0][0];
      expect(where.role).toBe('patient');
      expect(where.accountStatus).toBe('active');
    });

    it('excluye a quienes ya son compañeros de viaje', async () => {
      designationRepo.find.mockResolvedValue([
        { patientId: 'p9' },
        { patientId: 'p8' },
      ]);

      await service.listCandidates(PSICOLOGO);

      const { where } = userRepo.find.mock.calls[0][0];
      expect(JSON.stringify(where.id)).toContain('p9');
      expect(JSON.stringify(where.id)).toContain('p8');
    });

    it('no filtra por id cuando todavía no hay ninguno', async () => {
      designationRepo.find.mockResolvedValue([]);

      await service.listCandidates(PSICOLOGO);

      expect(userRepo.find.mock.calls[0][0].where.id).toBeUndefined();
    });

    it('acota el listado a la sede del psicólogo', async () => {
      await service.listCandidates(PSICOLOGO);

      expect(userRepo.find.mock.calls[0][0].where.sedeId).toBe('sede-1');
    });

    it('no acota por sede al coordinador, que no tiene una propia', async () => {
      await service.listCandidates(COORDINADOR);

      expect(userRepo.find.mock.calls[0][0].where.sedeId).toBeUndefined();
    });

    it('devuelve solo los campos necesarios para elegir', async () => {
      userRepo.find.mockResolvedValue([
        pacienteActivo({ email: 'carlos@stopbet.cl', rut: '11.111.111-1' }),
      ]);

      const result = await service.listCandidates(PSICOLOGO);

      // Ni RUT ni correo salen del backend: la pantalla solo necesita el nombre.
      expect(result).toEqual([
        { id: 'p1', firstName: 'Carlos', lastName: 'Rivas', sedeId: 'sede-1' },
      ]);
    });
  });

  // ── CA21.1 ───────────────────────────────────────────────────────────────

  describe('designate (CA21.1)', () => {
    it('registra al psicólogo que designó y la fecha', async () => {
      registrar(pacienteActivo());

      const result = await service.designate('p1', PSICOLOGO);

      expect(designationRepo.create).toHaveBeenCalledWith({
        patientId: 'p1',
        designatedBy: 'psi-1',
        isActive: true,
      });
      expect(result.patientName).toBe('Carlos Rivas');
      expect(result.designatedByName).toBe('Ana Soto');
      expect(result.designatedAt).toBe('2026-09-21T12:00:00.000Z');
      expect(result.isActive).toBe(true);
      expect(result.revokedAt).toBeNull();
    });

    it('falla con 404 si el paciente no existe', async () => {
      await expect(service.designate('nadie', PSICOLOGO)).rejects.toThrow(
        NotFoundException,
      );
      expect(designationRepo.save).not.toHaveBeenCalled();
    });

    it('rechaza designar a alguien que no es paciente', async () => {
      registrar(pacienteActivo({ role: 'psychologist' }));

      await expect(service.designate('p1', PSICOLOGO)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rechaza designar a un paciente suspendido', async () => {
      registrar(pacienteActivo({ accountStatus: 'suspended' }));

      await expect(service.designate('p1', PSICOLOGO)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rechaza designar a un paciente de otra sede', async () => {
      registrar(pacienteActivo({ sedeId: 'sede-2' }));

      await expect(service.designate('p1', PSICOLOGO)).rejects.toThrow(
        ForbiddenException,
      );
      expect(designationRepo.save).not.toHaveBeenCalled();
    });

    it('deja al coordinador designar fuera de una sede propia', async () => {
      registrar(pacienteActivo({ sedeId: 'sede-7' }));

      await expect(
        service.designate('p1', COORDINADOR),
      ).resolves.toMatchObject({ patientId: 'p1' });
    });

    it('no designa dos veces al mismo paciente', async () => {
      registrar(pacienteActivo());
      designationRepo.findOne.mockResolvedValue({ id: 'ya-existe' });

      await expect(service.designate('p1', PSICOLOGO)).rejects.toThrow(
        ConflictException,
      );
      expect(designationRepo.save).not.toHaveBeenCalled();
    });
  });

  // ── CA21.4 ───────────────────────────────────────────────────────────────

  describe('designate: aviso al designado (CA21.4)', () => {
    it('le avisa al paciente designado, no al psicólogo', async () => {
      registrar(pacienteActivo());

      await service.designate('p1', PSICOLOGO);

      const notificacion = notificationRepo.create.mock.calls[0][0];
      expect(notificacion.userId).toBe('p1');
    });

    it('el aviso explica el rol y que puede recibir alertas de pánico', async () => {
      registrar(pacienteActivo());

      await service.designate('p1', PSICOLOGO);

      const { title, body } = notificationRepo.create.mock.calls[0][0];
      expect(title).toContain('compañero de viaje');
      expect(body).toContain('alertas de pánico');
    });

    it('no avisa cuando la designación fue rechazada', async () => {
      registrar(pacienteActivo({ sedeId: 'sede-2' }));

      await expect(service.designate('p1', PSICOLOGO)).rejects.toThrow(
        ForbiddenException,
      );
      expect(notificationRepo.save).not.toHaveBeenCalled();
    });
  });

  // ── CA21.3 ───────────────────────────────────────────────────────────────

  describe('revoke (CA21.3)', () => {
    const designacionActiva = {
      id: 'd1',
      patientId: 'p1',
      designatedBy: 'psi-1',
      isActive: true,
      designatedAt: new Date('2026-09-21T12:00:00Z'),
      revokedAt: null,
      revokedBy: null,
    };

    it('cierra la designación dejando quién revocó y cuándo', async () => {
      registrar(pacienteActivo());
      designationRepo.findOne.mockResolvedValue({ ...designacionActiva });

      const result = await service.revoke('p1', PSICOLOGO);

      const guardado = designationRepo.save.mock.calls[0][0];
      expect(guardado.isActive).toBe(false);
      expect(guardado.revokedBy).toBe('psi-1');
      expect(guardado.revokedAt).toBeInstanceOf(Date);
      expect(result.isActive).toBe(false);
    });

    it('bloquea la revocación mientras tenga pacientes a cargo', async () => {
      registrar(pacienteActivo());
      designationRepo.findOne.mockResolvedValue({ ...designacionActiva });
      assignmentRepo.count.mockResolvedValue(3);

      await expect(service.revoke('p1', PSICOLOGO)).rejects.toThrow(
        ConflictException,
      );
      expect(designationRepo.save).not.toHaveBeenCalled();
    });

    it('dice cuántos pacientes hay que reasignar, sin nombrarlos', async () => {
      registrar(pacienteActivo());
      designationRepo.findOne.mockResolvedValue({ ...designacionActiva });
      assignmentRepo.count.mockResolvedValue(2);

      await expect(service.revoke('p1', PSICOLOGO)).rejects.toThrow(
        /2 paciente\(s\) a cargo/,
      );
    });

    it('solo cuenta las asignaciones activas', async () => {
      registrar(pacienteActivo());
      designationRepo.findOne.mockResolvedValue({ ...designacionActiva });

      await service.revoke('p1', PSICOLOGO);

      expect(assignmentRepo.count).toHaveBeenCalledWith({
        where: { sponsorId: 'p1', isActive: true },
      });
    });

    it('falla con 404 si no era compañero de viaje', async () => {
      registrar(pacienteActivo());
      designationRepo.findOne.mockResolvedValue(null);

      await expect(service.revoke('p1', PSICOLOGO)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rechaza revocar a alguien de otra sede', async () => {
      registrar(pacienteActivo({ sedeId: 'sede-2' }));
      designationRepo.findOne.mockResolvedValue({ ...designacionActiva });

      await expect(service.revoke('p1', PSICOLOGO)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('conserva la atribución al psicólogo que designó, no al que revoca', async () => {
      registrar(pacienteActivo());
      designationRepo.findOne.mockResolvedValue({ ...designacionActiva });

      const result = await service.revoke('p1', OTRO_PSICOLOGO);

      // Designó Ana, revocó Bruno: la designación sigue siendo de Ana.
      expect(result.designatedBy).toBe('psi-1');
      expect(result.designatedByName).toBe('Ana Soto');
    });
  });

  // ── CA20.2 ───────────────────────────────────────────────────────────────

  describe('listAvailable (CA20.2)', () => {
    it('falla con 404 si el paciente no existe', async () => {
      await expect(service.listAvailable('nadie', PSICOLOGO)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('devuelve vacío cuando todavía no hay nadie designado', async () => {
      registrar(pacienteActivo());
      designationRepo.find.mockResolvedValue([]);

      await expect(service.listAvailable('p1', PSICOLOGO)).resolves.toEqual([]);
      expect(userRepo.find).not.toHaveBeenCalled();
    });

    it('excluye al propio paciente de su lista de candidatos', async () => {
      registrar(pacienteActivo());
      designationRepo.find.mockResolvedValue([
        { patientId: 'p1' },
        { patientId: 'p7' },
      ]);

      await service.listAvailable('p1', PSICOLOGO);

      const { where } = userRepo.find.mock.calls[0][0];
      expect(JSON.stringify(where.id)).toContain('p7');
      expect(JSON.stringify(where.id)).not.toContain('p1');
    });

    it('devuelve vacío si el único designado era el propio paciente', async () => {
      registrar(pacienteActivo());
      designationRepo.find.mockResolvedValue([{ patientId: 'p1' }]);

      await expect(service.listAvailable('p1', PSICOLOGO)).resolves.toEqual([]);
    });

    // Solo se puede demostrar con el coordinador: un psicólogo ya no puede consultar
    // un paciente de otra sede, así que para él las dos sedes son siempre la misma.
    it('acota a la sede del paciente, no a la de quien consulta', async () => {
      registrar(pacienteActivo({ sedeId: 'sede-9' }));
      designationRepo.find.mockResolvedValue([{ patientId: 'p7' }]);

      await service.listAvailable('p1', COORDINADOR);

      expect(userRepo.find.mock.calls[0][0].where.sedeId).toBe('sede-9');
    });

    it('no deja consultar los candidatos de un paciente de otra sede', async () => {
      registrar(pacienteActivo({ sedeId: 'sede-2' }));

      await expect(service.listAvailable('p1', PSICOLOGO)).rejects.toThrow(
        ForbiddenException,
      );
      expect(userRepo.find).not.toHaveBeenCalled();
    });

    it('pide solo cuentas activas', async () => {
      registrar(pacienteActivo());
      designationRepo.find.mockResolvedValue([{ patientId: 'p7' }]);

      await service.listAvailable('p1', PSICOLOGO);

      expect(userRepo.find.mock.calls[0][0].where.accountStatus).toBe('active');
    });

    it('no expone RUT ni correo del candidato', async () => {
      registrar(pacienteActivo());
      designationRepo.find.mockResolvedValue([{ patientId: 'p7' }]);
      userRepo.find.mockResolvedValue([
        {
          id: 'p7',
          firstName: 'Daniela',
          lastName: 'Soto',
          sedeId: 'sede-1',
          email: 'dani@stopbet.cl',
          rut: '22.222.222-2',
        },
      ]);

      await expect(service.listAvailable('p1', PSICOLOGO)).resolves.toEqual([
        { id: 'p7', firstName: 'Daniela', lastName: 'Soto', sedeId: 'sede-1' },
      ]);
    });
  });

  // ── CA20.4 ───────────────────────────────────────────────────────────────

  describe('getCurrent (CA20.4)', () => {
    beforeEach(() => registrar(pacienteActivo()));

    it('no deja mirar el compañero de viaje de un paciente de otra sede', async () => {
      registrar(pacienteActivo({ sedeId: 'sede-2' }));

      await expect(service.getCurrent('p1', PSICOLOGO)).rejects.toThrow(
        ForbiddenException,
      );
      expect(assignmentRepo.findOne).not.toHaveBeenCalled();
    });

    it('falla con 404 si el paciente no existe', async () => {
      await expect(service.getCurrent('nadie', PSICOLOGO)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('el coordinador sí puede mirar cualquier sede', async () => {
      registrar(pacienteActivo({ sedeId: 'sede-9' }));

      await expect(service.getCurrent('p1', COORDINADOR)).resolves.toBeNull();
    });

    it('devuelve null cuando el paciente no tiene a nadie', async () => {
      assignmentRepo.findOne.mockResolvedValue(null);

      await expect(service.getCurrent('p1', PSICOLOGO)).resolves.toBeNull();
    });

    it('devuelve null si la asignación quedó sin persona cargada', async () => {
      assignmentRepo.findOne.mockResolvedValue({ patientId: 'p1', sponsor: null });

      await expect(service.getCurrent('p1', PSICOLOGO)).resolves.toBeNull();
    });

    it('solo mira la asignación activa', async () => {
      assignmentRepo.findOne.mockResolvedValue(null);

      await service.getCurrent('p1', PSICOLOGO);

      expect(assignmentRepo.findOne).toHaveBeenCalledWith({
        where: { patientId: 'p1', isActive: true },
        relations: ['sponsor'],
      });
    });

    it('devuelve el nombre sin exponer RUT ni correo', async () => {
      assignmentRepo.findOne.mockResolvedValue({
        patientId: 'p1',
        sponsor: {
          id: 's1',
          firstName: 'Daniela',
          lastName: 'Soto',
          sedeId: 'sede-1',
          email: 'dani@stopbet.cl',
          rut: '22.222.222-2',
        },
      });

      await expect(service.getCurrent('p1', PSICOLOGO)).resolves.toEqual({
        id: 's1',
        firstName: 'Daniela',
        lastName: 'Soto',
        sedeId: 'sede-1',
      });
    });
  });

  // ── CA20.1 y CA20.3 ──────────────────────────────────────────────────────

  describe('assign (CA20.1, CA20.3)', () => {
    const padrino = (over: Record<string, unknown> = {}) => ({
      id: 's1',
      firstName: 'Daniela',
      lastName: 'Soto',
      role: 'patient',
      accountStatus: 'active',
      sedeId: 'sede-1',
      ...over,
    });

    const conPadrinoDesignado = () => {
      registrar(pacienteActivo(), padrino());
      designationRepo.findOne.mockImplementation(({ where }) =>
        Promise.resolve(
          where.patientId === 's1' ? { id: 'd9', isActive: true } : null,
        ),
      );
    };

    it('cierra la asignación anterior y abre la nueva (CA20.3)', async () => {
      conPadrinoDesignado();

      await service.assign('p1', 's1', PSICOLOGO);

      expect(assignmentRepo.update).toHaveBeenCalledWith(
        { patientId: 'p1', isActive: true },
        { isActive: false },
      );
      expect(assignmentRepo.create).toHaveBeenCalledWith({
        patientId: 'p1',
        sponsorId: 's1',
        isActive: true,
      });
    });

    it('avisa a los dos, no solo al paciente (CA20.1)', async () => {
      conPadrinoDesignado();

      await service.assign('p1', 's1', PSICOLOGO);

      const avisos = notificationRepo.create.mock.calls.map((c) => c[0]);
      expect(avisos.map((a) => a.userId).sort()).toEqual(['p1', 's1']);
    });

    it('a cada uno le dice lo que le toca saber', async () => {
      conPadrinoDesignado();

      await service.assign('p1', 's1', PSICOLOGO);

      const avisos = notificationRepo.create.mock.calls.map((c) => c[0]);
      const alPaciente = avisos.find((a) => a.userId === 'p1');
      const alPadrino = avisos.find((a) => a.userId === 's1');
      expect(alPaciente.body).toContain('Daniela Soto');
      expect(alPadrino.body).toContain('Carlos Rivas');
    });

    it('rechaza a quien no fue designado compañero de viaje', async () => {
      registrar(pacienteActivo(), padrino());
      designationRepo.findOne.mockResolvedValue(null);

      await expect(service.assign('p1', 's1', PSICOLOGO)).rejects.toThrow(
        BadRequestException,
      );
      expect(assignmentRepo.save).not.toHaveBeenCalled();
    });

    it('rechaza a un compañero de viaje de otra sede', async () => {
      registrar(pacienteActivo(), padrino({ sedeId: 'sede-2' }));
      designationRepo.findOne.mockResolvedValue({ id: 'd9', isActive: true });

      await expect(service.assign('p1', 's1', PSICOLOGO)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rechaza a un compañero de viaje suspendido', async () => {
      registrar(pacienteActivo(), padrino({ accountStatus: 'suspended' }));
      designationRepo.findOne.mockResolvedValue({ id: 'd9', isActive: true });

      await expect(service.assign('p1', 's1', PSICOLOGO)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('no deja que alguien sea su propio compañero de viaje', async () => {
      await expect(service.assign('p1', 'p1', PSICOLOGO)).rejects.toThrow(
        BadRequestException,
      );
      expect(userRepo.findOne).not.toHaveBeenCalled();
    });

    it('falla con 404 si el paciente no existe', async () => {
      await expect(service.assign('nadie', 's1', PSICOLOGO)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('falla con 404 si el compañero de viaje no existe', async () => {
      registrar(pacienteActivo());

      await expect(service.assign('p1', 's1', PSICOLOGO)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rechaza asignar en un paciente de otra sede', async () => {
      registrar(pacienteActivo({ sedeId: 'sede-2' }), padrino());

      await expect(service.assign('p1', 's1', PSICOLOGO)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('funciona sin actor: es la ruta vieja POST /panic/assign', async () => {
      conPadrinoDesignado();

      await expect(service.assign('p1', 's1')).resolves.toBeUndefined();
      expect(assignmentRepo.save).toHaveBeenCalled();
    });
  });
});
