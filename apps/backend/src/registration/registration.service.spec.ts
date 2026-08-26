import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AuthUser } from '@stopbet/shared-types';
import { RegistrationService } from './registration.service';
import { RegistrationRequest } from './entities/registration-request.entity';
import { User } from '../users/entities/user.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { PatientAssignment } from '../psychologists/entities/patient-assignment.entity';

describe('RegistrationService — approve', () => {
  let service: RegistrationService;
  let requestRepo: { findOne: jest.Mock; update: jest.Mock; find: jest.Mock };
  let userRepo: { findOne: jest.Mock; update: jest.Mock };
  let notifRepo: { save: jest.Mock; create: jest.Mock };
  let assignmentRepo: { save: jest.Mock; create: jest.Mock };
  let sedeRepo: { findOne: jest.Mock };
  let psychSedeRepo: { find: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  const REQUEST_ID = 'req-1';
  const REVIEWER_ID = 'psych-reviewer';
  const SEDE_ID = 'sede-santiago';
  const pendingRequest = { id: REQUEST_ID, userId: 'pat-1', sedeId: SEDE_ID };
  const activePsychologist = { id: REVIEWER_ID, role: 'psychologist', accountStatus: 'active' };

  const reviewer = (over: Partial<AuthUser> = {}): AuthUser => ({
    id: REVIEWER_ID,
    email: 'reviewer@stopbet.cl',
    role: 'psychologist',
    firstName: 'Rev',
    lastName: 'Isor',
    sedeId: SEDE_ID,
    ...over,
  });

  beforeEach(() => {
    requestRepo = { findOne: jest.fn(), update: jest.fn(), find: jest.fn() };
    userRepo = { findOne: jest.fn(), update: jest.fn() };
    notifRepo = { save: jest.fn(), create: jest.fn((data) => data) };
    assignmentRepo = { save: jest.fn(), create: jest.fn((data) => data) };
    sedeRepo = { findOne: jest.fn() };
    // Por defecto el revisor cubre la sede de la solicitud: los casos de aprobación ya
    // pasaban por aquí antes de que existiera el filtro y no deben cambiar de resultado.
    psychSedeRepo = { find: jest.fn().mockResolvedValue([{ sedeId: SEDE_ID }]) };

    const manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === RegistrationRequest) return requestRepo;
        if (entity === User) return userRepo;
        if (entity === Notification) return notifRepo;
        if (entity === PatientAssignment) return assignmentRepo;
        throw new Error('Entidad sin mock en el spec');
      }),
    };
    dataSource = {
      transaction: jest.fn(async (run: (m: unknown) => Promise<unknown>) => run(manager)),
    };

    service = new RegistrationService(
      requestRepo as any,
      userRepo as any,
      notifRepo as any,
      sedeRepo as any,
      psychSedeRepo as any,
      dataSource as any,
    );
  });

  it('lanza 404 si la solicitud no existe', async () => {
    requestRepo.findOne.mockResolvedValue(null);
    await expect(service.approve('no-existe', reviewer())).rejects.toThrow(NotFoundException);
  });

  it('lanza 400 si el psicólogo asignado no existe o no está activo', async () => {
    requestRepo.findOne.mockResolvedValue(pendingRequest);
    userRepo.findOne.mockResolvedValue(null);

    await expect(service.approve(REQUEST_ID, reviewer())).rejects.toThrow(BadRequestException);
  });

  // El hallazgo que motivó todo esto: la tabla existía y nadie la escribía nunca, así que
  // las guardas de CA24.3 y CA24.5 leían siempre cero pacientes.
  it('crea la asignación del paciente al aprobar', async () => {
    requestRepo.findOne.mockResolvedValue(pendingRequest);
    userRepo.findOne.mockResolvedValue(activePsychologist);
    requestRepo.update.mockResolvedValue({ affected: 1 });

    await service.approve(REQUEST_ID, reviewer());

    expect(assignmentRepo.save).toHaveBeenCalledWith({
      patientId: 'pat-1',
      psychologistId: REVIEWER_ID,
      sedeId: SEDE_ID,
      active: true,
      endedAt: null,
    });
  });

  it('asigna al psicólogo indicado en vez de a quien revisa', async () => {
    requestRepo.findOne.mockResolvedValue(pendingRequest);
    userRepo.findOne.mockResolvedValue({ id: 'psych-otro', accountStatus: 'active' });
    requestRepo.update.mockResolvedValue({ affected: 1 });

    await service.approve(REQUEST_ID, reviewer(), { assignedPsychologistId: 'psych-otro' });

    expect(assignmentRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ psychologistId: 'psych-otro' }),
    );
  });

  it('rechaza con 409 una solicitud que ya fue procesada', async () => {
    requestRepo.findOne.mockResolvedValue(pendingRequest);
    userRepo.findOne.mockResolvedValue(activePsychologist);
    requestRepo.update.mockResolvedValue({ affected: 0 });

    await expect(service.approve(REQUEST_ID, reviewer())).rejects.toThrow(ConflictException);
    expect(assignmentRepo.save).not.toHaveBeenCalled();
  });

  // TypeORM declara `affected` como opcional: comprobarlo con `=== 0` dejaría pasar un
  // undefined y la doble aprobación crearía dos asignaciones en silencio.
  it('rechaza con 409 si el driver no informa filas afectadas', async () => {
    requestRepo.findOne.mockResolvedValue(pendingRequest);
    userRepo.findOne.mockResolvedValue(activePsychologist);
    requestRepo.update.mockResolvedValue({});

    await expect(service.approve(REQUEST_ID, reviewer())).rejects.toThrow(ConflictException);
    expect(assignmentRepo.save).not.toHaveBeenCalled();
  });

  it('aprueba dentro de una única transacción', async () => {
    requestRepo.findOne.mockResolvedValue(pendingRequest);
    userRepo.findOne.mockResolvedValue(activePsychologist);
    requestRepo.update.mockResolvedValue({ affected: 1 });

    await service.approve(REQUEST_ID, reviewer());

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(userRepo.update).toHaveBeenCalledWith('pat-1', {
      onboardingStatus: 'payment_pending',
    });
    expect(notifRepo.save).toHaveBeenCalled();
  });

  describe('cobertura por sede', () => {
    it('un psicólogo no puede aprobar una solicitud de otra sede', async () => {
      requestRepo.findOne.mockResolvedValue(pendingRequest);
      psychSedeRepo.find.mockResolvedValue([{ sedeId: 'sede-concepcion' }]);

      await expect(service.approve(REQUEST_ID, reviewer())).rejects.toThrow(ForbiddenException);
      expect(assignmentRepo.save).not.toHaveBeenCalled();
    });

    it('tampoco puede rechazarla', async () => {
      requestRepo.findOne.mockResolvedValue(pendingRequest);
      psychSedeRepo.find.mockResolvedValue([{ sedeId: 'sede-concepcion' }]);

      await expect(service.reject(REQUEST_ID, reviewer())).rejects.toThrow(ForbiddenException);
      expect(requestRepo.update).not.toHaveBeenCalled();
    });

    // Si el coordinador viera solo sus sedes, una sede que se queda sin psicólogos no
    // tendría a nadie capaz de aprobar sus solicitudes.
    it('el coordinador aprueba cualquier sede', async () => {
      requestRepo.findOne.mockResolvedValue(pendingRequest);
      userRepo.findOne.mockResolvedValue({ id: 'psych-otro', accountStatus: 'active' });
      requestRepo.update.mockResolvedValue({ affected: 1 });
      psychSedeRepo.find.mockResolvedValue([]);

      await service.approve(REQUEST_ID, reviewer({ role: 'coordinator', sedeId: null }), {
        assignedPsychologistId: 'psych-otro',
      });

      expect(assignmentRepo.save).toHaveBeenCalled();
      expect(psychSedeRepo.find).not.toHaveBeenCalled();
    });

    // El seed guarda el NOMBRE de la sede en User.sedeId, no su UUID: sin traducirlo, el
    // psicólogo legado no cubriría ninguna sede y no podría aprobar nada.
    it('traduce la sede legada guardada por nombre', async () => {
      requestRepo.findOne.mockResolvedValue(pendingRequest);
      userRepo.findOne.mockResolvedValue(activePsychologist);
      requestRepo.update.mockResolvedValue({ affected: 1 });
      psychSedeRepo.find.mockResolvedValue([]);
      sedeRepo.findOne.mockResolvedValue({ id: SEDE_ID, name: 'Santiago' });

      await service.approve(REQUEST_ID, reviewer({ sedeId: 'Santiago' }));

      expect(sedeRepo.findOne).toHaveBeenCalledWith({ where: { name: 'Santiago' } });
      expect(assignmentRepo.save).toHaveBeenCalled();
    });
  });

  describe('listPending', () => {
    it('el psicólogo solo ve las solicitudes de sus sedes', async () => {
      requestRepo.find.mockResolvedValue([]);

      await service.listPending(reviewer());

      expect(requestRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'pending', sedeId: expect.anything() }),
        }),
      );
    });

    it('un psicólogo sin sedes no ve ninguna solicitud, y no consulta la tabla', async () => {
      psychSedeRepo.find.mockResolvedValue([]);
      sedeRepo.findOne.mockResolvedValue(null);

      const result = await service.listPending(reviewer({ sedeId: null }));

      expect(result).toEqual([]);
      expect(requestRepo.find).not.toHaveBeenCalled();
    });

    it('el coordinador las ve todas, sin filtro de sede', async () => {
      requestRepo.find.mockResolvedValue([]);

      await service.listPending(reviewer({ role: 'coordinator' }));

      expect(requestRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'pending' } }),
      );
    });
  });
});
