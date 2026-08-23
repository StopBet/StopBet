import * as bcrypt from 'bcrypt';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PsychologistsService } from './psychologists.service';

describe('PsychologistsService', () => {
  let service: PsychologistsService;
  let userRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  let sedeRepo: { find: jest.Mock };
  let psychSedeRepo: { find: jest.Mock; save: jest.Mock; create: jest.Mock; delete: jest.Mock };
  let assignmentRepo: { count: jest.Mock; find: jest.Mock; update: jest.Mock };

  const santiago = { id: 'sede-santiago', name: 'Santiago', isActive: true };
  const online = { id: 'sede-online', name: 'Online', isActive: true };

  beforeEach(() => {
    userRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn((data) => data),
      update: jest.fn(),
    };
    sedeRepo = { find: jest.fn() };
    psychSedeRepo = {
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn((data) => data),
      delete: jest.fn(),
    };
    assignmentRepo = { count: jest.fn(), find: jest.fn(), update: jest.fn() };

    service = new PsychologistsService(
      userRepo as any,
      sedeRepo as any,
      psychSedeRepo as any,
      assignmentRepo as any,
    );
  });

  describe('create', () => {
    const dto = {
      firstName: 'Fernanda',
      lastName: 'Fuentes',
      email: 'fernanda.fuentes@ajuter.cl',
      rut: '12.345.678-5',
      sedeIds: ['sede-santiago', 'sede-online'],
    };

    it('rechaza con 409 si el correo ya existe', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'existing' });
      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('rechaza con 400 si alguna sede no existe o está inactiva', async () => {
      userRepo.findOne.mockResolvedValue(null);
      sedeRepo.find.mockResolvedValue([santiago]); // falta 'sede-online'
      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('crea al psicólogo, sus sedes, y devuelve una contraseña temporal válida', async () => {
      userRepo.findOne.mockResolvedValue(null);
      sedeRepo.find.mockResolvedValue([santiago, online]);
      userRepo.save.mockImplementation(async (data) => ({ id: 'new-psych', ...data }));

      const result = await service.create(dto);

      expect(result.id).toBe('new-psych');
      expect(result.temporaryPassword).toHaveLength(12);
      expect(result.sedes).toEqual([santiago, online]);

      const savedUser = userRepo.save.mock.calls[0][0];
      expect(savedUser.role).toBe('psychologist');
      expect(savedUser.passwordHash).not.toBeNull();
      expect(
        await bcrypt.compare(result.temporaryPassword, savedUser.passwordHash),
      ).toBe(true);

      expect(psychSedeRepo.save).toHaveBeenCalledWith([
        { psychologistId: 'new-psych', sedeId: 'sede-santiago' },
        { psychologistId: 'new-psych', sedeId: 'sede-online' },
      ]);
    });
  });

  describe('findAll', () => {
    it('devuelve arreglo vacío cuando no hay psicólogos', async () => {
      userRepo.find.mockResolvedValue([]);
      expect(await service.findAll()).toEqual([]);
    });

    it('arma cada item con sus sedes y el conteo de pacientes activos', async () => {
      userRepo.find.mockResolvedValue([
        { id: 'psych-1', firstName: 'Fernanda', lastName: 'Fuentes', email: 'f@ajuter.cl', accountStatus: 'active' },
      ]);
      psychSedeRepo.find.mockResolvedValue([{ sedeId: 'sede-santiago' }]);
      sedeRepo.find.mockResolvedValue([santiago]);
      assignmentRepo.count.mockResolvedValue(3);

      const result = await service.findAll();

      expect(result).toEqual([
        {
          id: 'psych-1',
          firstName: 'Fernanda',
          lastName: 'Fuentes',
          email: 'f@ajuter.cl',
          accountStatus: 'active',
          sedes: [santiago],
          patientCount: 3,
        },
      ]);
    });
  });

  describe('findOne', () => {
    it('lanza 404 si el psicólogo no existe', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('no-existe')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivate', () => {
    it('lanza 404 si el psicólogo no existe', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.deactivate('no-existe', {})).rejects.toThrow(NotFoundException);
    });

    it('desactiva directo cuando no tiene pacientes activos', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'psych-1', role: 'psychologist' });
      assignmentRepo.find.mockResolvedValue([]);

      await service.deactivate('psych-1', {});

      expect(userRepo.update).toHaveBeenCalledWith('psych-1', { accountStatus: 'suspended' });
    });

    it('rechaza con 409 y la lista de pacientes si tiene activos y no manda reassignTo', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'psych-1', role: 'psychologist' });
      assignmentRepo.find.mockResolvedValue([
        { id: 'a1', patientId: 'pat-1', sedeId: 'sede-santiago' },
      ]);

      await expect(service.deactivate('psych-1', {})).rejects.toThrow(ConflictException);
    });

    it('rechaza con 400 si reassignTo es el mismo psicólogo', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'psych-1', role: 'psychologist' });
      assignmentRepo.find.mockResolvedValue([
        { id: 'a1', patientId: 'pat-1', sedeId: 'sede-santiago' },
      ]);

      await expect(
        service.deactivate('psych-1', { reassignTo: 'psych-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('reasigna y desactiva cuando el destino cubre la sede de todos los pacientes', async () => {
      userRepo.findOne
        .mockResolvedValueOnce({ id: 'psych-1', role: 'psychologist' }) // psicólogo a desactivar
        .mockResolvedValueOnce({ id: 'psych-2', accountStatus: 'active' }); // destino
      assignmentRepo.find.mockResolvedValue([
        { id: 'a1', patientId: 'pat-1', sedeId: 'sede-santiago' },
      ]);
      psychSedeRepo.find.mockResolvedValue([{ sedeId: 'sede-santiago' }]);

      await service.deactivate('psych-1', { reassignTo: 'psych-2' });

      expect(assignmentRepo.update).toHaveBeenCalledWith(
        { id: expect.anything() },
        { psychologistId: 'psych-2' },
      );
      expect(userRepo.update).toHaveBeenCalledWith('psych-1', { accountStatus: 'suspended' });
    });
  });

  describe('updateSedes', () => {
    it('rechaza con 400 si alguna sede nueva no existe o está inactiva', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'psych-1', role: 'psychologist' });
      sedeRepo.find.mockResolvedValue([]);

      await expect(
        service.updateSedes('psych-1', { sedeIds: ['sede-inexistente'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('agrega una sede sin pedir nada si no hay pacientes afectados', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'psych-1', role: 'psychologist' });
      sedeRepo.find.mockResolvedValue([santiago, online]);
      psychSedeRepo.find.mockResolvedValue([{ id: 'link-1', sedeId: 'sede-santiago' }]);
      assignmentRepo.find.mockResolvedValue([]);

      await service.updateSedes('psych-1', { sedeIds: ['sede-santiago', 'sede-online'] });

      expect(psychSedeRepo.save).toHaveBeenCalledWith([
        { psychologistId: 'psych-1', sedeId: 'sede-online' },
      ]);
      expect(psychSedeRepo.delete).not.toHaveBeenCalled();
    });

    it('rechaza con 409 al quitar una sede con pacientes activos sin plan de reasignación', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'psych-1', role: 'psychologist' });
      sedeRepo.find.mockResolvedValue([online]);
      psychSedeRepo.find.mockResolvedValue([
        { id: 'link-1', sedeId: 'sede-santiago' },
        { id: 'link-2', sedeId: 'sede-online' },
      ]);
      assignmentRepo.find.mockResolvedValue([
        { id: 'a1', patientId: 'pat-1', sedeId: 'sede-santiago' },
      ]);

      await expect(
        service.updateSedes('psych-1', { sedeIds: ['sede-online'] }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
