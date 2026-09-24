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
  let assignmentRepo: { count: jest.Mock };
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
    assignmentRepo = { count: jest.fn().mockResolvedValue(0) };
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
});
