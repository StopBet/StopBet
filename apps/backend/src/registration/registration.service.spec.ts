import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AuthUser } from '@stopbet/shared-types';
import { RegistrationService } from './registration.service';
import { RegistrationRequest } from './entities/registration-request.entity';
import { RegistrationReview } from './entities/registration-review.entity';
import { User } from '../users/entities/user.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { PatientAssignment } from '../psychologists/entities/patient-assignment.entity';

describe('RegistrationService — approve', () => {
  let service: RegistrationService;
  let requestRepo: { findOne: jest.Mock; update: jest.Mock; find: jest.Mock };
  let userRepo: { findOne: jest.Mock; update: jest.Mock; find: jest.Mock };
  let notifRepo: { save: jest.Mock; create: jest.Mock };
  let assignmentRepo: { save: jest.Mock; create: jest.Mock };
  let reviewRepo: { save: jest.Mock; create: jest.Mock; find: jest.Mock };
  let sedeRepo: { findOne: jest.Mock };
  let psychSedeRepo: { find: jest.Mock };
  let dataSource: { transaction: jest.Mock; getRepository: jest.Mock };
  let mailService: { send: jest.Mock; ajuterContact: string | undefined };

  const REQUEST_ID = 'req-1';
  const REVIEWER_ID = 'psych-reviewer';
  const SEDE_ID = 'sede-santiago';
  const pendingRequest = { id: REQUEST_ID, userId: 'pat-1', sedeId: SEDE_ID };
  const activePsychologist = {
    id: REVIEWER_ID,
    role: 'psychologist',
    accountStatus: 'active',
    email: 'psi@ejemplo.cl',
    firstName: 'Psi',
    lastName: 'Cólogo',
  };

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
    userRepo = { findOne: jest.fn().mockResolvedValue(null), update: jest.fn(), find: jest.fn() };
    notifRepo = { save: jest.fn(), create: jest.fn((data) => data) };
    assignmentRepo = { save: jest.fn(), create: jest.fn((data) => data) };
    reviewRepo = { save: jest.fn(), create: jest.fn((data) => data), find: jest.fn() };
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
        if (entity === RegistrationReview) return reviewRepo;
        throw new Error('Entidad sin mock en el spec');
      }),
    };
    dataSource = {
      transaction: jest.fn(async (run: (m: unknown) => Promise<unknown>) => run(manager)),
      getRepository: jest.fn(() => reviewRepo),
    };

    mailService = { send: jest.fn().mockResolvedValue(true), ajuterContact: undefined };

    service = new RegistrationService(
      requestRepo as any,
      userRepo as any,
      notifRepo as any,
      sedeRepo as any,
      psychSedeRepo as any,
      dataSource as any,
      mailService as any,
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

  // HdU19 CA6: la fila queda en la misma transacción que el cambio de estado.
  it('registra la auditoría de la aprobación con el rol de quien decide', async () => {
    requestRepo.findOne.mockResolvedValue(pendingRequest);
    userRepo.findOne.mockResolvedValue(activePsychologist);
    requestRepo.update.mockResolvedValue({ affected: 1 });

    await service.approve(REQUEST_ID, reviewer({ role: 'coordinator', sedeId: null }), {
      assignedPsychologistId: REVIEWER_ID,
    });

    expect(reviewRepo.save).toHaveBeenCalledWith({
      requestId: REQUEST_ID,
      verdict: 'approved',
      reviewedBy: REVIEWER_ID,
      reviewerRole: 'coordinator',
    });
  });

  it('no registra auditoría si la aprobación pierde la carrera (409)', async () => {
    requestRepo.findOne.mockResolvedValue(pendingRequest);
    userRepo.findOne.mockResolvedValue(activePsychologist);
    requestRepo.update.mockResolvedValue({ affected: 0 });

    await expect(service.approve(REQUEST_ID, reviewer())).rejects.toThrow(ConflictException);
    expect(reviewRepo.save).not.toHaveBeenCalled();
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
      psychSedeRepo.find.mockResolvedValue([{ sedeId: SEDE_ID }]);

      await service.approve(REQUEST_ID, reviewer({ role: 'coordinator', sedeId: null }), {
        assignedPsychologistId: 'psych-otro',
      });

      expect(assignmentRepo.save).toHaveBeenCalled();
      // Las sedes que se consultan son las del psicólogo asignado, no las del coordinador.
      expect(psychSedeRepo.find).toHaveBeenCalledTimes(1);
      expect(psychSedeRepo.find).toHaveBeenCalledWith({ where: { psychologistId: 'psych-otro' } });
    });

    it('el coordinador no puede asignar a un psicólogo que no atiende la sede del paciente', async () => {
      requestRepo.findOne.mockResolvedValue(pendingRequest);
      userRepo.findOne.mockResolvedValue({ id: 'psych-otro', accountStatus: 'active' });
      psychSedeRepo.find.mockResolvedValue([{ sedeId: 'sede-concepcion' }]);

      await expect(
        service.approve(REQUEST_ID, reviewer({ role: 'coordinator', sedeId: null }), {
          assignedPsychologistId: 'psych-otro',
        }),
      ).rejects.toThrow('no atiende la sede del paciente');

      // Falla antes de tocar nada: ni se aprueba la solicitud ni se crea la asignación.
      expect(requestRepo.update).not.toHaveBeenCalled();
      expect(assignmentRepo.save).not.toHaveBeenCalled();
    });

    it('un psicólogo sin ninguna sede registrada tampoco puede quedar asignado', async () => {
      requestRepo.findOne.mockResolvedValue(pendingRequest);
      userRepo.findOne.mockResolvedValue({ id: 'psych-otro', accountStatus: 'active', sedeId: null });
      psychSedeRepo.find.mockResolvedValue([]);
      sedeRepo.findOne.mockResolvedValue(null);

      await expect(
        service.approve(REQUEST_ID, reviewer({ role: 'coordinator', sedeId: null }), {
          assignedPsychologistId: 'psych-otro',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(assignmentRepo.save).not.toHaveBeenCalled();
    });

    // El seed guarda el NOMBRE de la sede en User.sedeId, no su UUID: sin traducirlo, el
    // psicólogo legado no cubriría ninguna sede y no podría aprobar nada.
    it('traduce la sede legada guardada por nombre', async () => {
      requestRepo.findOne.mockResolvedValue(pendingRequest);
      userRepo.findOne.mockResolvedValue({ ...activePsychologist, sedeId: 'Santiago' });
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

    // CA1: el RUT viene de la relación `user`, ya descifrado por el transformer de la columna.
    it('devuelve el RUT del solicitante desde la relación', async () => {
      requestRepo.find.mockResolvedValue([
        {
          id: REQUEST_ID,
          userId: 'pat-1',
          sedeId: SEDE_ID,
          createdAt: new Date('2026-10-01T12:00:00Z'),
          user: { firstName: 'Ana', lastName: 'Soto', email: 'ana@stopbet.cl', rut: '12.345.678-5', phone: '912345678' },
        },
      ]);

      const result = await service.listPending(reviewer({ role: 'coordinator' }));

      expect(requestRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ relations: ['user'] }),
      );
      expect(result).toEqual([
        {
          id: REQUEST_ID,
          userId: 'pat-1',
          sedeId: SEDE_ID,
          firstName: 'Ana',
          lastName: 'Soto',
          email: 'ana@stopbet.cl',
          rut: '12.345.678-5',
          phone: '912345678',
          createdAt: '2026-10-01T12:00:00.000Z',
        },
      ]);
    });

    it('omite las solicitudes cuyo usuario ya no existe', async () => {
      requestRepo.find.mockResolvedValue([
        { id: REQUEST_ID, userId: 'pat-1', sedeId: SEDE_ID, createdAt: new Date(), user: null },
      ]);

      const result = await service.listPending(reviewer({ role: 'coordinator' }));

      expect(result).toEqual([]);
    });
  });

  describe('reject', () => {
    it('rechaza, registra la auditoría y notifica al paciente', async () => {
      requestRepo.findOne.mockResolvedValue(pendingRequest);
      requestRepo.update.mockResolvedValue({ affected: 1 });

      await service.reject(REQUEST_ID, reviewer({ role: 'coordinator', sedeId: null }));

      expect(requestRepo.update).toHaveBeenCalledWith(
        { id: REQUEST_ID, status: 'pending' },
        expect.objectContaining({ status: 'rejected', reviewedBy: REVIEWER_ID }),
      );
      expect(reviewRepo.save).toHaveBeenCalledWith({
        requestId: REQUEST_ID,
        verdict: 'rejected',
        reviewedBy: REVIEWER_ID,
        reviewerRole: 'coordinator',
      });
      expect(notifRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'pat-1', type: 'warning' }),
      );
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    });

    // Antes el update no miraba el estado: se podía rechazar una solicitud ya aprobada.
    it('da 409 si la solicitud no está pendiente, sin auditoría ni aviso', async () => {
      requestRepo.findOne.mockResolvedValue(pendingRequest);
      requestRepo.update.mockResolvedValue({ affected: 0 });

      await expect(
        service.reject(REQUEST_ID, reviewer({ role: 'coordinator', sedeId: null })),
      ).rejects.toThrow(ConflictException);
      expect(reviewRepo.save).not.toHaveBeenCalled();
      expect(notifRepo.save).not.toHaveBeenCalled();
    });

    it('da 404 si la solicitud no existe', async () => {
      requestRepo.findOne.mockResolvedValue(null);

      await expect(
        service.reject('no-existe', reviewer({ role: 'coordinator', sedeId: null })),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('reopen', () => {
    const coordinator = () => reviewer({ role: 'coordinator', sedeId: null });

    it('vuelve a pendiente, limpia al revisor, registra la auditoría y notifica', async () => {
      requestRepo.findOne.mockResolvedValue(pendingRequest);
      requestRepo.update.mockResolvedValue({ affected: 1 });

      await service.reopen(REQUEST_ID, coordinator());

      expect(requestRepo.update).toHaveBeenCalledWith(
        { id: REQUEST_ID, status: 'rejected' },
        { status: 'pending', reviewedBy: null, reviewedAt: null },
      );
      expect(reviewRepo.save).toHaveBeenCalledWith({
        requestId: REQUEST_ID,
        verdict: 'reopened',
        reviewedBy: REVIEWER_ID,
        reviewerRole: 'coordinator',
      });
      expect(notifRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'pat-1',
          type: 'info',
          title: 'Tu solicitud volvió a revisión',
        }),
      );
    });

    it('da 409 si la solicitud no está rechazada, sin auditoría ni aviso', async () => {
      requestRepo.findOne.mockResolvedValue(pendingRequest);
      requestRepo.update.mockResolvedValue({ affected: 0 });

      await expect(service.reopen(REQUEST_ID, coordinator())).rejects.toThrow(ConflictException);
      expect(reviewRepo.save).not.toHaveBeenCalled();
      expect(notifRepo.save).not.toHaveBeenCalled();
    });

    it('da 404 si la solicitud no existe', async () => {
      requestRepo.findOne.mockResolvedValue(null);

      await expect(service.reopen('no-existe', coordinator())).rejects.toThrow(NotFoundException);
    });
  });

  describe('listRejected', () => {
    it('filtra por estado rechazado y resuelve quién la rechazó con una sola consulta', async () => {
      requestRepo.find.mockResolvedValue([
        {
          id: 'req-1',
          userId: 'pat-1',
          sedeId: SEDE_ID,
          reviewedBy: 'coord-1',
          reviewedAt: new Date('2026-10-02T15:30:00Z'),
          createdAt: new Date('2026-10-01T12:00:00Z'),
          user: { firstName: 'Ana', lastName: 'Soto', email: 'ana@stopbet.cl', rut: '12.345.678-5' },
        },
        {
          id: 'req-2',
          userId: 'pat-2',
          sedeId: SEDE_ID,
          reviewedBy: 'coord-1',
          reviewedAt: new Date('2026-10-01T10:00:00Z'),
          createdAt: new Date('2026-09-30T12:00:00Z'),
          user: { firstName: 'Luis', lastName: 'Pérez', email: 'luis@stopbet.cl', rut: null, phone: '' },
        },
      ]);
      userRepo.find.mockResolvedValue([{ id: 'coord-1', firstName: 'Miguel', lastName: 'Ángel' }]);

      const result = await service.listRejected(reviewer({ role: 'coordinator', sedeId: null }));

      expect(requestRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'rejected' },
          relations: ['user'],
          take: 50,
        }),
      );
      expect(userRepo.find).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 'req-1',
          rut: '12.345.678-5',
          reviewedAt: '2026-10-02T15:30:00.000Z',
          reviewedByName: 'Miguel Ángel',
        }),
      );
      expect(result[1].rut).toBeNull();
      expect(result[1].phone).toBeNull();
    });

    it('un revisor sin sedes no ve ninguna y no consulta la tabla', async () => {
      psychSedeRepo.find.mockResolvedValue([]);
      sedeRepo.findOne.mockResolvedValue(null);

      const result = await service.listRejected(reviewer({ sedeId: null }));

      expect(result).toEqual([]);
      expect(requestRepo.find).not.toHaveBeenCalled();
    });
  });

  // El correo sale sin esperarlo (no traba al coordinador), así que hay que dejar que la
  // promesa suelta termine antes de mirar qué se envió.
  const flush = () => new Promise((resolve) => setImmediate(resolve));
  const patient = { email: 'pat@ejemplo.cl', firstName: 'Ana' };

  describe('listHistory', () => {
    const at = new Date('2026-10-07T18:30:38.000Z');

    it('une cada decisión con el paciente y con quién la tomó, sin perder el rol', async () => {
      reviewRepo.find.mockResolvedValue([
        { id: 'rv-2', requestId: 'req-2', verdict: 'reopened', reviewedBy: 'u-1', reviewerRole: 'coordinator', reviewedAt: at },
        { id: 'rv-1', requestId: 'req-1', verdict: 'rejected', reviewedBy: 'u-1', reviewerRole: 'coordinator', reviewedAt: at },
      ]);
      requestRepo.find.mockResolvedValue([
        { id: 'req-1', user: { firstName: 'Ana', lastName: 'Rojas' } },
        { id: 'req-2', user: { firstName: 'Luis', lastName: 'Paz' } },
      ]);
      userRepo.find.mockResolvedValue([{ id: 'u-1', firstName: 'Sofía', lastName: 'Reyes' }]);

      const result = await service.listHistory();

      expect(reviewRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ order: { reviewedAt: 'DESC' }, take: 100 }),
      );
      expect(result).toEqual([
        { id: 'rv-2', reviewedAt: at.toISOString(), verdict: 'reopened', reviewerName: 'Sofía Reyes', reviewerRole: 'coordinator', patientName: 'Luis Paz' },
        { id: 'rv-1', reviewedAt: at.toISOString(), verdict: 'rejected', reviewerName: 'Sofía Reyes', reviewerRole: 'coordinator', patientName: 'Ana Rojas' },
      ]);
    });

    it('si la cuenta de quien decidió o del paciente ya no existe, la fila sigue y el nombre es null', async () => {
      reviewRepo.find.mockResolvedValue([
        { id: 'rv-1', requestId: 'req-9', verdict: 'approved', reviewedBy: 'u-borrado', reviewerRole: 'coordinator', reviewedAt: at },
      ]);
      requestRepo.find.mockResolvedValue([]);
      userRepo.find.mockResolvedValue([]);

      const [entry] = await service.listHistory();

      expect(entry.patientName).toBeNull();
      expect(entry.reviewerName).toBeNull();
      expect(entry.verdict).toBe('approved');
    });

    it('sin decisiones no consulta nada más', async () => {
      reviewRepo.find.mockResolvedValue([]);

      expect(await service.listHistory()).toEqual([]);
      expect(requestRepo.find).not.toHaveBeenCalled();
      expect(userRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('correo al paciente', () => {
    it('al aprobar avisa con el nombre del psicólogo asignado', async () => {
      requestRepo.findOne.mockResolvedValue(pendingRequest);
      requestRepo.update.mockResolvedValue({ affected: 1 });
      userRepo.findOne
        .mockResolvedValueOnce({ ...activePsychologist, firstName: 'Camila', lastName: 'Soto' })
        .mockResolvedValueOnce(patient);

      await service.approve(REQUEST_ID, reviewer());
      await flush();

      expect(mailService.send).toHaveBeenCalledTimes(1);
      const mail = mailService.send.mock.calls[0][0];
      expect(mail.to).toBe('pat@ejemplo.cl');
      expect(mail.subject).toMatch(/aprobada/);
      expect(mail.text).toContain('Camila Soto');
      expect(mail.html).toContain('Camila Soto');
    });

    it('no envía nada si la aprobación pierde la carrera (409)', async () => {
      requestRepo.findOne.mockResolvedValue(pendingRequest);
      userRepo.findOne.mockResolvedValue(activePsychologist);
      requestRepo.update.mockResolvedValue({ affected: 0 });

      await expect(service.approve(REQUEST_ID, reviewer())).rejects.toThrow(ConflictException);
      await flush();

      expect(mailService.send).not.toHaveBeenCalled();
    });

    it('al rechazar avisa e incluye el contacto de AJUTER si está configurado', async () => {
      mailService.ajuterContact = 'contacto@ajuter.example';
      requestRepo.findOne.mockResolvedValue(pendingRequest);
      requestRepo.update.mockResolvedValue({ affected: 1 });
      userRepo.findOne.mockResolvedValue(patient);

      await service.reject(REQUEST_ID, reviewer({ role: 'coordinator', sedeId: null }));
      await flush();

      const mail = mailService.send.mock.calls[0][0];
      expect(mail.to).toBe('pat@ejemplo.cl');
      expect(mail.text).toContain('contacto@ajuter.example');
    });

    it('sin contacto configurado no inventa ninguno', async () => {
      requestRepo.findOne.mockResolvedValue(pendingRequest);
      requestRepo.update.mockResolvedValue({ affected: 1 });
      userRepo.findOne.mockResolvedValue(patient);

      await service.reject(REQUEST_ID, reviewer({ role: 'coordinator', sedeId: null }));
      await flush();

      const mail = mailService.send.mock.calls[0][0];
      expect(mail.text).toContain('comunícate con AJUTER.');
      expect(mail.text).not.toContain('@');
    });

    it('al reabrir avisa que volvió a revisión', async () => {
      requestRepo.findOne.mockResolvedValue(pendingRequest);
      requestRepo.update.mockResolvedValue({ affected: 1 });
      userRepo.findOne.mockResolvedValue(patient);

      await service.reopen(REQUEST_ID, reviewer({ role: 'coordinator', sedeId: null }));
      await flush();

      expect(mailService.send.mock.calls[0][0].subject).toMatch(/volvió a revisión/);
    });

    it('si el correo falla, la decisión no se deshace ni lanza', async () => {
      requestRepo.findOne.mockResolvedValue(pendingRequest);
      requestRepo.update.mockResolvedValue({ affected: 1 });
      userRepo.findOne.mockRejectedValue(new Error('BD caída'));

      await expect(
        service.reject(REQUEST_ID, reviewer({ role: 'coordinator', sedeId: null })),
      ).resolves.toBeUndefined();
      await flush();

      expect(mailService.send).not.toHaveBeenCalled();
    });
  });
});
