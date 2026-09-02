import * as bcrypt from 'bcrypt';
import { QueryFailedError } from 'typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PsychologistsService } from './psychologists.service';
import { User } from '../users/entities/user.entity';
import { Sede } from '../sedes/entities/sede.entity';
import { PsychologistSede } from './entities/psychologist-sede.entity';
import { PatientAssignment } from './entities/patient-assignment.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';

describe('PsychologistsService', () => {
  let service: PsychologistsService;
  let userRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  let sedeRepo: { find: jest.Mock; findOne: jest.Mock };
  let psychSedeRepo: { find: jest.Mock; save: jest.Mock; create: jest.Mock; delete: jest.Mock };
  let assignmentRepo: {
    count: jest.Mock;
    find: jest.Mock;
    update: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };
  let refreshTokenRepo: { update: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let mailService: { send: jest.Mock; webAppUrl: string };

  const santiago = { id: 'sede-santiago', name: 'Santiago', isActive: true };
  const online = { id: 'sede-online', name: 'Online', isActive: true };

  // `resolveSedeId` solo devuelve el valor tal cual si tiene forma de UUID; con ids de
  // fantasía cae siempre en la traducción por nombre y se prueba la rama equivocada.
  const SANTIAGO_UUID = '11111111-1111-4111-8111-111111111111';
  const ONLINE_UUID = '22222222-2222-4222-8222-222222222222';
  const santiagoReal = { id: SANTIAGO_UUID, name: 'Santiago', isActive: true };
  const onlineReal = { id: ONLINE_UUID, name: 'Online', isActive: true };

  beforeEach(() => {
    userRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn((data) => data),
      update: jest.fn(),
    };
    sedeRepo = { find: jest.fn(), findOne: jest.fn() };
    psychSedeRepo = {
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn((data) => data),
      delete: jest.fn(),
    };
    assignmentRepo = {
      count: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
      save: jest.fn(),
      create: jest.fn((data) => data),
    };
    refreshTokenRepo = { update: jest.fn() };
    mailService = { send: jest.fn().mockResolvedValue(true), webAppUrl: 'https://panel.stopbet.cl' };

    // El manager enruta a los mismos mocks que usa el resto del spec, así las aserciones
    // sobre `assignmentRepo.update` y compañía siguen valiendo dentro de la transacción.
    const manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === User) return userRepo;
        if (entity === Sede) return sedeRepo;
        if (entity === PsychologistSede) return psychSedeRepo;
        if (entity === PatientAssignment) return assignmentRepo;
        if (entity === RefreshToken) return refreshTokenRepo;
        throw new Error('Entidad sin mock en el spec');
      }),
    };
    dataSource = {
      transaction: jest.fn(async (run: (m: unknown) => Promise<unknown>) => run(manager)),
    };

    service = new PsychologistsService(
      userRepo as any,
      sedeRepo as any,
      psychSedeRepo as any,
      assignmentRepo as any,
      dataSource as any,
      mailService as any,
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

    // Carrera: dos creaciones simultáneas pasan las dos el findOne y la restricción única de
    // la BD rechaza la segunda. Sin traducir ese error, el usuario recibía un 500.
    it('rechaza con 409 si la BD detecta el correo duplicado en el insert', async () => {
      userRepo.findOne.mockResolvedValue(null);
      sedeRepo.find.mockResolvedValue([santiago, online]);
      userRepo.save.mockRejectedValue(
        new QueryFailedError('insert', [], { code: '23505' } as unknown as Error),
      );

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('propaga cualquier otro error de la BD sin disfrazarlo de 409', async () => {
      userRepo.findOne.mockResolvedValue(null);
      sedeRepo.find.mockResolvedValue([santiago, online]);
      userRepo.save.mockRejectedValue(
        new QueryFailedError('insert', [], { code: '23503' } as unknown as Error),
      );

      await expect(service.create(dto)).rejects.toThrow(QueryFailedError);
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

    // CA24.1: "el sistema la genera ... y le envía sus credenciales de acceso".
    it('le envía por correo la misma contraseña temporal que devuelve', async () => {
      userRepo.findOne.mockResolvedValue(null);
      sedeRepo.find.mockResolvedValue([santiago, online]);
      userRepo.save.mockImplementation(async (data) => ({ id: 'new-psych', ...data }));

      const result = await service.create(dto);

      expect(result.credentialsEmailSent).toBe(true);
      expect(mailService.send).toHaveBeenCalledTimes(1);

      const enviado = mailService.send.mock.calls[0][0];
      expect(enviado.to).toBe(dto.email);
      expect(enviado.text).toContain(result.temporaryPassword);
    });

    // El correo es el último paso y es best-effort: la cuenta ya está en la BD y deshacerla
    // porque el SMTP esté caído dejaría al coordinador sin nada. Se informa y se sigue.
    it('deja la cuenta creada aunque el correo falle, y lo informa en la respuesta', async () => {
      userRepo.findOne.mockResolvedValue(null);
      sedeRepo.find.mockResolvedValue([santiago, online]);
      userRepo.save.mockImplementation(async (data) => ({ id: 'new-psych', ...data }));
      mailService.send.mockResolvedValue(false);

      const result = await service.create(dto);

      expect(result.id).toBe('new-psych');
      expect(result.credentialsEmailSent).toBe(false);
      // Sigue viniendo en la respuesta: es el respaldo para la entrega a mano.
      expect(result.temporaryPassword).toHaveLength(12);
    });
  });

  describe('findAll', () => {
    it('devuelve arreglo vacío cuando no hay psicólogos', async () => {
      userRepo.find.mockResolvedValue([]);
      expect(await service.findAll()).toEqual([]);
    });

    // Al paralelizar con Promise.all el orden lo fija la posicion en el arreglo, no cual
    // consulta responde antes: se hace responder primero a la segunda para que un fallo salte.
    it('conserva el orden aunque una consulta termine antes que otra', async () => {
      userRepo.find.mockResolvedValue([
        { id: 'psych-1', firstName: 'Ana', lastName: 'Alvarez', email: 'a@ajuter.cl', accountStatus: 'active' },
        { id: 'psych-2', firstName: 'Bruno', lastName: 'Bravo', email: 'b@ajuter.cl', accountStatus: 'active' },
      ]);
      psychSedeRepo.find.mockResolvedValue([{ sedeId: 'sede-santiago' }]);
      sedeRepo.find.mockResolvedValue([santiago]);
      assignmentRepo.find
        .mockImplementationOnce(
          () =>
            new Promise((resolve) =>
              setTimeout(() => resolve([{ patientId: 'p-1', sedeId: 'sede-santiago' }]), 20),
            ),
        )
        .mockImplementationOnce(() =>
          Promise.resolve([
            { patientId: 'p-2', sedeId: 'sede-santiago' },
            { patientId: 'p-3', sedeId: 'sede-santiago' },
          ]),
        );

      const result = await service.findAll();

      expect(result.map((p) => p.id)).toEqual(['psych-1', 'psych-2']);
      expect(result.map((p) => p.patientCount)).toEqual([1, 2]);
    });

    it('arma cada item con sus sedes y el conteo de pacientes activos', async () => {
      userRepo.find.mockResolvedValue([
        { id: 'psych-1', firstName: 'Fernanda', lastName: 'Fuentes', email: 'f@ajuter.cl', accountStatus: 'active' },
      ]);
      psychSedeRepo.find.mockResolvedValue([{ sedeId: 'sede-santiago' }]);
      sedeRepo.find.mockResolvedValue([santiago]);
      assignmentRepo.find.mockResolvedValue([
        { patientId: 'p-1', sedeId: 'sede-santiago' },
        { patientId: 'p-2', sedeId: 'sede-santiago' },
        { patientId: 'p-3', sedeId: 'sede-santiago' },
      ]);

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
          patientsBySede: [{ sedeId: 'sede-santiago', sedeName: 'Santiago', count: 3 }],
        },
      ]);
    });

    it('reparte el conteo por sede y omite las sedes sin pacientes activos', async () => {
      userRepo.find.mockResolvedValue([
        { id: 'psych-1', firstName: 'Fernanda', lastName: 'Fuentes', email: 'f@ajuter.cl', accountStatus: 'active' },
      ]);
      psychSedeRepo.find.mockResolvedValue([{ sedeId: 'sede-santiago' }, { sedeId: 'sede-online' }]);
      sedeRepo.find.mockResolvedValue([santiago, online]);
      assignmentRepo.find.mockResolvedValue([
        { patientId: 'p-1', sedeId: 'sede-santiago' },
        { patientId: 'p-2', sedeId: 'sede-santiago' },
      ]);

      const [item] = await service.findAll();

      expect(item.patientCount).toBe(2);
      expect(item.patientsBySede).toEqual([
        { sedeId: 'sede-santiago', sedeName: 'Santiago', count: 2 },
      ]);
    });

    // Puede pasar si se le quitó la sede al psicólogo dejando pacientes atrás: esconderlos
    // del desglose los dejaría fuera de cualquier reasignación.
    it('muestra a los pacientes de una sede que el psicólogo ya no atiende', async () => {
      userRepo.find.mockResolvedValue([
        { id: 'psych-1', firstName: 'Fernanda', lastName: 'Fuentes', email: 'f@ajuter.cl', accountStatus: 'active' },
      ]);
      psychSedeRepo.find.mockResolvedValue([{ sedeId: 'sede-santiago' }]);
      sedeRepo.find.mockResolvedValue([santiago]);
      assignmentRepo.find.mockResolvedValue([{ patientId: 'p-1', sedeId: 'sede-huerfana' }]);

      const [item] = await service.findAll();

      expect(item.patientsBySede).toEqual([
        { sedeId: 'sede-huerfana', sedeName: 'sede-huerfana', count: 1 },
      ]);
    });
  });

  describe('findOne', () => {
    it('lanza 404 si el psicólogo no existe', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('no-existe')).rejects.toThrow(NotFoundException);
    });

    // Respaldo temporal para psicólogos anteriores a psychologist_sedes. Estos dos tests se
    // borran junto con el fallback, cuando exista la migración que rellene la tabla.
    it('usa el User.sedeId legado si no tiene filas en psychologist_sedes', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'psych-viejo',
        role: 'psychologist',
        sedeId: 'sede-santiago',
      });
      psychSedeRepo.find.mockResolvedValue([]);
      sedeRepo.findOne.mockResolvedValue(santiago);
      sedeRepo.find.mockResolvedValue([santiago]);
      assignmentRepo.find.mockResolvedValue([]);

      const result = await service.findOne('psych-viejo');

      expect(sedeRepo.find).toHaveBeenCalledWith({ where: { id: expect.anything() } });
      expect(result.sedes).toEqual([santiago]);
    });

    // El seed compartido guarda el NOMBRE de la sede en User.sedeId, no su UUID. Consultar
    // `sedes.id` con 'Santiago' aborta la query entera y la lista responde 500.
    it('traduce la sede legada guardada por nombre en vez de romper la consulta', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'psych-seed',
        role: 'psychologist',
        sedeId: 'Santiago',
      });
      psychSedeRepo.find.mockResolvedValue([]);
      sedeRepo.findOne.mockResolvedValue(santiago);
      sedeRepo.find.mockResolvedValue([santiago]);
      assignmentRepo.find.mockResolvedValue([]);

      const result = await service.findOne('psych-seed');

      expect(sedeRepo.findOne).toHaveBeenCalledWith({ where: { name: 'Santiago' } });
      expect(result.sedes).toEqual([santiago]);
    });

    it('si la sede legada no corresponde a ninguna sede, devuelve 0 sedes sin reventar', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'psych-huerfano',
        role: 'psychologist',
        sedeId: 'Sede Que No Existe',
      });
      psychSedeRepo.find.mockResolvedValue([]);
      sedeRepo.findOne.mockResolvedValue(null);
      assignmentRepo.find.mockResolvedValue([]);

      const result = await service.findOne('psych-huerfano');

      expect(result.sedes).toEqual([]);
      expect(sedeRepo.find).not.toHaveBeenCalled();
    });

    it('devuelve sin sedes si no tiene ni filas nuevas ni sede legada', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'psych-sin-sede', role: 'psychologist' });
      psychSedeRepo.find.mockResolvedValue([]);
      assignmentRepo.find.mockResolvedValue([]);

      const result = await service.findOne('psych-sin-sede');

      expect(result.sedes).toEqual([]);
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

      // La asignación vieja se cierra en vez de sobrescribirse, para no perder el historial
      // de quién atendía al paciente antes de la reasignación.
      expect(assignmentRepo.update).toHaveBeenCalledWith(
        { id: expect.anything() },
        { active: false, endedAt: expect.any(Date) },
      );
      expect(assignmentRepo.save).toHaveBeenCalledWith([
        {
          patientId: 'pat-1',
          psychologistId: 'psych-2',
          sedeId: 'sede-santiago',
          active: true,
          endedAt: null,
        },
      ]);
      expect(userRepo.update).toHaveBeenCalledWith('psych-1', { accountStatus: 'suspended' });
    });

    // El caso que bloqueaba la baja: exigir un único destino que cubriera todas las sedes
    // dejaba imposible desactivar a quien atiende varias sin un reemplazo exacto.
    it('reparte a los pacientes de cada sede al destino que le corresponde', async () => {
      userRepo.findOne
        .mockResolvedValueOnce({ id: 'psych-1', role: 'psychologist' }) // el que se desactiva
        .mockResolvedValueOnce({ id: 'psych-santiago', accountStatus: 'active' })
        .mockResolvedValueOnce({ id: 'psych-online', accountStatus: 'active' });
      assignmentRepo.find.mockResolvedValue([
        { id: 'a1', patientId: 'pat-1', sedeId: 'sede-santiago' },
        { id: 'a2', patientId: 'pat-2', sedeId: 'sede-online' },
      ]);
      psychSedeRepo.find
        .mockResolvedValueOnce([{ sedeId: 'sede-santiago' }])
        .mockResolvedValueOnce([{ sedeId: 'sede-online' }]);

      await service.deactivate('psych-1', {
        reassignments: {
          'sede-santiago': 'psych-santiago',
          'sede-online': 'psych-online',
        },
      });

      expect(assignmentRepo.save).toHaveBeenCalledWith([
        { patientId: 'pat-1', psychologistId: 'psych-santiago', sedeId: 'sede-santiago', active: true, endedAt: null },
      ]);
      expect(assignmentRepo.save).toHaveBeenCalledWith([
        { patientId: 'pat-2', psychologistId: 'psych-online', sedeId: 'sede-online', active: true, endedAt: null },
      ]);
      expect(userRepo.update).toHaveBeenCalledWith('psych-1', { accountStatus: 'suspended' });
    });

    it('el 409 dice qué sedes quedaron sin destino, no solo que faltan pacientes', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'psych-1', role: 'psychologist' });
      assignmentRepo.find.mockResolvedValue([
        { id: 'a1', patientId: 'pat-1', sedeId: 'sede-santiago' },
        { id: 'a2', patientId: 'pat-2', sedeId: 'sede-online' },
      ]);

      await expect(
        service.deactivate('psych-1', { reassignments: { 'sede-santiago': 'psych-2' } }),
      ).rejects.toMatchObject({
        response: {
          patientIds: ['pat-1', 'pat-2'],
          bySede: [{ sedeId: 'sede-online', patientIds: ['pat-2'] }],
        },
      });
    });

    // Sin transacción, un fallo al suspender dejaba a los pacientes ya movidos y al
    // psicólogo todavía activo. Todo el cuerpo va dentro de dataSource.transaction().
    it('corre reasignación y suspensión dentro de una única transacción', async () => {
      userRepo.findOne
        .mockResolvedValueOnce({ id: 'psych-1', role: 'psychologist' })
        .mockResolvedValueOnce({ id: 'psych-2', accountStatus: 'active' });
      assignmentRepo.find.mockResolvedValue([
        { id: 'a1', patientId: 'pat-1', sedeId: 'sede-santiago' },
      ]);
      psychSedeRepo.find.mockResolvedValue([{ sedeId: 'sede-santiago' }]);

      await service.deactivate('psych-1', { reassignTo: 'psych-2' });

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    });

    it('propaga el fallo de la suspensión para que la transacción revierta', async () => {
      userRepo.findOne
        .mockResolvedValueOnce({ id: 'psych-1', role: 'psychologist' })
        .mockResolvedValueOnce({ id: 'psych-2', accountStatus: 'active' });
      assignmentRepo.find.mockResolvedValue([
        { id: 'a1', patientId: 'pat-1', sedeId: 'sede-santiago' },
      ]);
      psychSedeRepo.find.mockResolvedValue([{ sedeId: 'sede-santiago' }]);
      userRepo.update.mockRejectedValue(new Error('conexión caída'));

      await expect(
        service.deactivate('psych-1', { reassignTo: 'psych-2' }),
      ).rejects.toThrow('conexión caída');
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

    it('quita una sede directo, sin pedir reasignación, si no tiene pacientes activos ahí', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'psych-1', role: 'psychologist' });
      sedeRepo.find.mockResolvedValue([online]);
      psychSedeRepo.find.mockResolvedValue([
        { id: 'link-1', sedeId: 'sede-santiago' },
        { id: 'link-2', sedeId: 'sede-online' },
      ]);
      assignmentRepo.find.mockResolvedValue([]); // sin pacientes activos en sede-santiago

      await service.updateSedes('psych-1', { sedeIds: ['sede-online'] });

      expect(psychSedeRepo.delete).toHaveBeenCalledWith({ id: expect.anything() });
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

    // El sedeId legado va dentro del JWT: si queda apuntando a una sede que ya no atiende,
    // el psicólogo sigue autenticándose como parte de ella.
    it('realinea el sedeId legado cuando se quita justo esa sede', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'psych-1',
        role: 'psychologist',
        sedeId: SANTIAGO_UUID,
      });
      sedeRepo.find.mockResolvedValue([onlineReal]);
      psychSedeRepo.find.mockResolvedValue([
        { id: 'link-1', sedeId: SANTIAGO_UUID },
        { id: 'link-2', sedeId: ONLINE_UUID },
      ]);
      assignmentRepo.find.mockResolvedValue([]);

      await service.updateSedes('psych-1', { sedeIds: [ONLINE_UUID] });

      expect(userRepo.update).toHaveBeenCalledWith('psych-1', { sedeId: ONLINE_UUID });
    });

    it('no toca el sedeId legado si esa sede sigue estando', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'psych-1',
        role: 'psychologist',
        sedeId: SANTIAGO_UUID,
      });
      sedeRepo.find.mockResolvedValue([santiagoReal, onlineReal]);
      psychSedeRepo.find.mockResolvedValue([{ id: 'link-1', sedeId: SANTIAGO_UUID }]);
      assignmentRepo.find.mockResolvedValue([]);

      await service.updateSedes('psych-1', { sedeIds: [SANTIAGO_UUID, ONLINE_UUID] });

      expect(userRepo.update).not.toHaveBeenCalled();
    });

    // Las cuentas viejas y las del seed guardan el NOMBRE de la sede, no su UUID: sin
    // traducirlo primero, 'Santiago' nunca coincide con la lista y se reescribiría de más.
    it('reconoce la sede legada guardada por nombre y no la reescribe', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'psych-1',
        role: 'psychologist',
        sedeId: 'Santiago',
      });
      sedeRepo.find.mockResolvedValue([santiago, online]);
      sedeRepo.findOne.mockResolvedValue(santiago);
      psychSedeRepo.find.mockResolvedValue([{ id: 'link-1', sedeId: 'sede-santiago' }]);
      assignmentRepo.find.mockResolvedValue([]);

      await service.updateSedes('psych-1', { sedeIds: ['sede-santiago', 'sede-online'] });

      expect(userRepo.update).not.toHaveBeenCalled();
    });

    it('asigna una sede legada al psicologo que no tenia ninguna', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'psych-1', role: 'psychologist', sedeId: null });
      sedeRepo.find.mockResolvedValue([online]);
      psychSedeRepo.find.mockResolvedValue([]);
      assignmentRepo.find.mockResolvedValue([]);

      await service.updateSedes('psych-1', { sedeIds: ['sede-online'] });

      expect(userRepo.update).toHaveBeenCalledWith('psych-1', { sedeId: 'sede-online' });
    });
  });
});
