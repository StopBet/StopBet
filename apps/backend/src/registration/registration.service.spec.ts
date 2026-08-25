import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { RegistrationService } from './registration.service';
import { RegistrationRequest } from './entities/registration-request.entity';
import { User } from '../users/entities/user.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { PatientAssignment } from '../psychologists/entities/patient-assignment.entity';

describe('RegistrationService — approve', () => {
  let service: RegistrationService;
  let requestRepo: { findOne: jest.Mock; update: jest.Mock };
  let userRepo: { findOne: jest.Mock; update: jest.Mock };
  let notifRepo: { save: jest.Mock; create: jest.Mock };
  let assignmentRepo: { save: jest.Mock; create: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  const REQUEST_ID = 'req-1';
  const REVIEWER_ID = 'psych-reviewer';
  const pendingRequest = { id: REQUEST_ID, userId: 'pat-1', sedeId: 'sede-santiago' };
  const activePsychologist = { id: REVIEWER_ID, role: 'psychologist', accountStatus: 'active' };

  beforeEach(() => {
    requestRepo = { findOne: jest.fn(), update: jest.fn() };
    userRepo = { findOne: jest.fn(), update: jest.fn() };
    notifRepo = { save: jest.fn(), create: jest.fn((data) => data) };
    assignmentRepo = { save: jest.fn(), create: jest.fn((data) => data) };

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
      dataSource as any,
    );
  });

  it('lanza 404 si la solicitud no existe', async () => {
    requestRepo.findOne.mockResolvedValue(null);
    await expect(service.approve('no-existe', REVIEWER_ID)).rejects.toThrow(NotFoundException);
  });

  it('lanza 400 si el psicólogo asignado no existe o no está activo', async () => {
    requestRepo.findOne.mockResolvedValue(pendingRequest);
    userRepo.findOne.mockResolvedValue(null);

    await expect(service.approve(REQUEST_ID, REVIEWER_ID)).rejects.toThrow(BadRequestException);
  });

  // El hallazgo que motivó todo esto: la tabla existía y nadie la escribía nunca, así que
  // las guardas de CA24.3 y CA24.5 leían siempre cero pacientes.
  it('crea la asignación del paciente al aprobar', async () => {
    requestRepo.findOne.mockResolvedValue(pendingRequest);
    userRepo.findOne.mockResolvedValue(activePsychologist);
    requestRepo.update.mockResolvedValue({ affected: 1 });

    await service.approve(REQUEST_ID, REVIEWER_ID);

    expect(assignmentRepo.save).toHaveBeenCalledWith({
      patientId: 'pat-1',
      psychologistId: REVIEWER_ID,
      sedeId: 'sede-santiago',
      active: true,
      endedAt: null,
    });
  });

  it('asigna al psicólogo indicado en vez de a quien revisa', async () => {
    requestRepo.findOne.mockResolvedValue(pendingRequest);
    userRepo.findOne.mockResolvedValue({ id: 'psych-otro', accountStatus: 'active' });
    requestRepo.update.mockResolvedValue({ affected: 1 });

    await service.approve(REQUEST_ID, REVIEWER_ID, { assignedPsychologistId: 'psych-otro' });

    expect(assignmentRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ psychologistId: 'psych-otro' }),
    );
  });

  it('rechaza con 409 una solicitud que ya fue procesada', async () => {
    requestRepo.findOne.mockResolvedValue(pendingRequest);
    userRepo.findOne.mockResolvedValue(activePsychologist);
    requestRepo.update.mockResolvedValue({ affected: 0 });

    await expect(service.approve(REQUEST_ID, REVIEWER_ID)).rejects.toThrow(ConflictException);
    expect(assignmentRepo.save).not.toHaveBeenCalled();
  });

  // TypeORM declara `affected` como opcional: comprobarlo con `=== 0` dejaría pasar un
  // undefined y la doble aprobación crearía dos asignaciones en silencio.
  it('rechaza con 409 si el driver no informa filas afectadas', async () => {
    requestRepo.findOne.mockResolvedValue(pendingRequest);
    userRepo.findOne.mockResolvedValue(activePsychologist);
    requestRepo.update.mockResolvedValue({});

    await expect(service.approve(REQUEST_ID, REVIEWER_ID)).rejects.toThrow(ConflictException);
    expect(assignmentRepo.save).not.toHaveBeenCalled();
  });

  it('aprueba dentro de una única transacción', async () => {
    requestRepo.findOne.mockResolvedValue(pendingRequest);
    userRepo.findOne.mockResolvedValue(activePsychologist);
    requestRepo.update.mockResolvedValue({ affected: 1 });

    await service.approve(REQUEST_ID, REVIEWER_ID);

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(userRepo.update).toHaveBeenCalledWith('pat-1', {
      onboardingStatus: 'payment_pending',
    });
    expect(notifRepo.save).toHaveBeenCalled();
  });
});
