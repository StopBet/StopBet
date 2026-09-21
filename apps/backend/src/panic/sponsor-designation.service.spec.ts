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

  beforeEach(() => {
    designationRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((v) =>
        Promise.resolve({ id: 'd1', designatedAt: new Date('2026-09-21T12:00:00Z'), revokedAt: null, ...v }),
      ),
      create: jest.fn((v) => v),
    };
    userRepo = { find: jest.fn().mockResolvedValue([]), findOne: jest.fn() };

    service = new SponsorDesignationService(
      designationRepo as any,
      userRepo as any,
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

    it('excluye a quienes ya son padrinos', async () => {
      designationRepo.find.mockResolvedValue([
        { patientId: 'p9' },
        { patientId: 'p8' },
      ]);

      await service.listCandidates(PSICOLOGO);

      // El id queda envuelto en Not(In([...])); lo que importa es que la condición
      // llegue con los dos excluidos dentro.
      const { where } = userRepo.find.mock.calls[0][0];
      expect(JSON.stringify(where.id)).toContain('p9');
      expect(JSON.stringify(where.id)).toContain('p8');
    });

    it('no filtra por id cuando todavía no hay ningún padrino', async () => {
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
      userRepo.findOne.mockResolvedValue(pacienteActivo());

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
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.designate('nadie', PSICOLOGO)).rejects.toThrow(
        NotFoundException,
      );
      expect(designationRepo.save).not.toHaveBeenCalled();
    });

    it('rechaza designar a alguien que no es paciente', async () => {
      userRepo.findOne.mockResolvedValue(
        pacienteActivo({ role: 'psychologist' }),
      );

      await expect(service.designate('p1', PSICOLOGO)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rechaza designar a un paciente suspendido', async () => {
      userRepo.findOne.mockResolvedValue(
        pacienteActivo({ accountStatus: 'suspended' }),
      );

      await expect(service.designate('p1', PSICOLOGO)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rechaza designar a un paciente de otra sede', async () => {
      userRepo.findOne.mockResolvedValue(pacienteActivo({ sedeId: 'sede-2' }));

      await expect(service.designate('p1', PSICOLOGO)).rejects.toThrow(
        ForbiddenException,
      );
      expect(designationRepo.save).not.toHaveBeenCalled();
    });

    it('deja al coordinador designar fuera de una sede propia', async () => {
      userRepo.findOne.mockResolvedValue(pacienteActivo({ sedeId: 'sede-7' }));

      await expect(
        service.designate('p1', COORDINADOR),
      ).resolves.toMatchObject({ patientId: 'p1' });
    });

    it('no designa dos veces al mismo paciente', async () => {
      userRepo.findOne.mockResolvedValue(pacienteActivo());
      designationRepo.findOne.mockResolvedValue({ id: 'ya-existe' });

      await expect(service.designate('p1', PSICOLOGO)).rejects.toThrow(
        ConflictException,
      );
      expect(designationRepo.save).not.toHaveBeenCalled();
    });
  });
});
