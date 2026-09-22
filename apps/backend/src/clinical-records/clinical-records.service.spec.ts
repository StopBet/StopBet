import { NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ClinicalRecordsService } from './clinical-records.service';
import { SaveClinicalRecordDto } from './dto/save-clinical-record.dto';

const FICHA_COMPLETA = {
  admissionReason: 'Derivado por su pareja tras perder el sueldo en apuestas.',
  gamblingHistory: 'Juega hace 6 años, casinos en línea desde 2024.',
  triggers: 'Días de pago y publicidad de casinos en partidos.',
  healthAndSupport: 'Sin patología previa. Vive con su pareja.',
  treatmentGoals: 'Sostener la abstinencia a 90 días.',
};

describe('ClinicalRecordsService', () => {
  let service: ClinicalRecordsService;
  let recordRepo: { findOne: jest.Mock; find: jest.Mock };
  let versionRepo: { find: jest.Mock };
  let userRepo: { find: jest.Mock };
  let assignmentRepo: { find: jest.Mock };
  let noteRepo: { find: jest.Mock; create: jest.Mock; save: jest.Mock };
  let registrationRepo: { findOne: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  // Repos dentro de la transacción: es donde ocurre el guardado y el versionado.
  let txRecords: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let txVersions: { count: jest.Mock; create: jest.Mock; save: jest.Mock };

  beforeEach(() => {
    recordRepo = { findOne: jest.fn().mockResolvedValue(null), find: jest.fn().mockResolvedValue([]) };
    versionRepo = { find: jest.fn().mockResolvedValue([]) };
    userRepo = {
      find: jest.fn().mockResolvedValue([
        { id: 'psi-1', firstName: 'Ana', lastName: 'Rivas' },
      ]),
    };

    txRecords = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((v) => v),
      save: jest.fn((v) =>
        Promise.resolve({
          id: 'ficha-1',
          createdAt: new Date('2026-09-19T10:00:00Z'),
          updatedAt: new Date('2026-09-19T10:00:00Z'),
          ...v,
        }),
      ),
    };
    txVersions = {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn((v) => v),
      save: jest.fn((v) => Promise.resolve(v)),
    };

    dataSource = {
      transaction: jest.fn((cb) =>
        cb({
          getRepository: (entity: { name: string }) =>
            entity.name === 'ClinicalRecord' ? txRecords : txVersions,
        }),
      ),
    };

    assignmentRepo = { find: jest.fn().mockResolvedValue([]) };
    noteRepo = {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((v) => v),
      save: jest.fn((v) =>
        Promise.resolve({ id: 'nota-1', createdAt: new Date('2026-09-19T15:00:00Z'), ...v }),
      ),
    };

    registrationRepo = { findOne: jest.fn().mockResolvedValue(null) };

    service = new ClinicalRecordsService(
      recordRepo as any,
      versionRepo as any,
      userRepo as any,
      noteRepo as any,
      assignmentRepo as any,
      registrationRepo as any,
      dataSource as any,
    );
  });

  describe('CA1 — ficha vacía la primera vez', () => {
    it('devuelve los cinco campos en blanco en vez de 404 cuando el paciente no tiene ficha', async () => {
      const view = await service.getForPatient('pac-1');

      expect(view.exists).toBe(false);
      expect(view.record).toBeNull();
      expect(view.content).toEqual({
        admissionReason: '',
        gamblingHistory: '',
        triggers: '',
        healthAndSupport: '',
        treatmentGoals: '',
      });
    });
  });

  describe('CA2 — guardado con autor y fecha', () => {
    it('registra quién modificó y devuelve su nombre resuelto', async () => {
      const ficha = await service.save('pac-1', FICHA_COMPLETA as SaveClinicalRecordDto, 'psi-1');

      expect(txRecords.save).toHaveBeenCalledWith(
        expect.objectContaining({ patientId: 'pac-1', updatedBy: 'psi-1' }),
      );
      expect(ficha.updatedBy).toBe('psi-1');
      expect(ficha.updatedByName).toBe('Ana Rivas');
      expect(ficha.updatedAt).toBe('2026-09-19T10:00:00.000Z');
    });

    it('guarda la ficha y su versión en la misma transacción', async () => {
      await service.save('pac-1', FICHA_COMPLETA as SaveClinicalRecordDto, 'psi-1');

      // Si el versionado quedara fuera, una caída entre ambos escribiría la ficha sin dejar
      // rastro de quién la cambió, que es justo lo que el CA4 tiene que garantizar.
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(txVersions.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('CA3 — campos obligatorios', () => {
    const validar = async (payload: Record<string, unknown>) => {
      const dto = plainToInstance(SaveClinicalRecordDto, payload);
      const errores = await validate(dto);
      return errores.map((e) => e.property);
    };

    it('bloquea el guardado si falta el motivo de ingreso', async () => {
      expect(await validar({ ...FICHA_COMPLETA, admissionReason: '' })).toEqual([
        'admissionReason',
      ]);
    });

    it('rechaza un campo con solo espacios, que si no entraría como texto válido', async () => {
      expect(await validar({ ...FICHA_COMPLETA, treatmentGoals: '    ' })).toEqual([
        'treatmentGoals',
      ]);
    });

    it('señala todos los campos pendientes a la vez, no solo el primero', async () => {
      const pendientes = await validar({
        ...FICHA_COMPLETA,
        admissionReason: '',
        triggers: '',
      });
      expect(pendientes.sort()).toEqual(['admissionReason', 'triggers']);
    });

    it('concuerda el mensaje con el número del campo', async () => {
      const mensajes = async (payload: Record<string, unknown>) => {
        const dto = plainToInstance(SaveClinicalRecordDto, payload);
        const errores = await validate(dto);
        return errores.flatMap((e) => Object.values(e.constraints ?? {}));
      };

      expect(await mensajes({ ...FICHA_COMPLETA, admissionReason: '' })).toContain(
        'El motivo de ingreso es obligatorio',
      );
      // En plural decía «Los detonantes es obligatorio».
      expect(await mensajes({ ...FICHA_COMPLETA, triggers: '' })).toContain(
        'Los detonantes son obligatorios',
      );
    });

    it('acepta la ficha completa', async () => {
      expect(await validar(FICHA_COMPLETA)).toEqual([]);
    });
  });

  describe('CA4 — historial de cambios', () => {
    it('registra solo los campos que cambiaron, con su valor antes y después', async () => {
      txRecords.findOne.mockResolvedValue({
        id: 'ficha-1',
        patientId: 'pac-1',
        ...FICHA_COMPLETA,
        triggers: 'Solo los días de pago.',
        updatedBy: 'psi-1',
      });
      txVersions.count.mockResolvedValue(1);

      await service.save('pac-1', FICHA_COMPLETA as SaveClinicalRecordDto, 'psi-2');

      expect(txVersions.save).toHaveBeenCalledWith(
        expect.objectContaining({
          versionNumber: 2,
          changedBy: 'psi-2',
          changedFields: [
            {
              field: 'triggers',
              before: 'Solo los días de pago.',
              after: FICHA_COMPLETA.triggers,
            },
          ],
        }),
      );
    });

    it('no crea una versión cuando se guarda sin cambiar nada', async () => {
      txRecords.findOne.mockResolvedValue({
        id: 'ficha-1',
        patientId: 'pac-1',
        ...FICHA_COMPLETA,
        updatedBy: 'psi-1',
        createdAt: new Date('2026-09-19T10:00:00Z'),
        updatedAt: new Date('2026-09-19T10:00:00Z'),
      });

      const ficha = await service.save('pac-1', FICHA_COMPLETA as SaveClinicalRecordDto, 'psi-2');

      // La ficha vuelve intacta: sigue figurando quien la escribió de verdad, no quien
      // apretó guardar sin cambiar nada.
      expect(ficha.updatedBy).toBe('psi-1');

      expect(txVersions.save).not.toHaveBeenCalled();
      expect(txRecords.save).not.toHaveBeenCalled();
    });

    it('devuelve las versiones de la más reciente a la más antigua, con el nombre del autor', async () => {
      recordRepo.findOne.mockResolvedValue({ id: 'ficha-1', patientId: 'pac-1' });
      versionRepo.find.mockResolvedValue([
        {
          id: 'v2',
          recordId: 'ficha-1',
          versionNumber: 2,
          changedBy: 'psi-1',
          changedFields: [{ field: 'triggers', before: 'a', after: 'b' }],
          changedAt: new Date('2026-09-19T12:00:00Z'),
        },
      ]);

      const historial = await service.getHistory('pac-1');

      expect(versionRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ order: { versionNumber: 'DESC' } }),
      );
      expect(historial[0].changedByName).toBe('Ana Rivas');
      expect(historial[0].changedAt).toBe('2026-09-19T12:00:00.000Z');
    });

    it('no inventa un nombre cuando el autor ya no está en la base', async () => {
      recordRepo.findOne.mockResolvedValue({ id: 'ficha-1', patientId: 'pac-1' });
      versionRepo.find.mockResolvedValue([
        {
          id: 'v1',
          recordId: 'ficha-1',
          versionNumber: 1,
          changedBy: 'psi-borrado',
          changedFields: [],
          changedAt: new Date('2026-09-19T12:00:00Z'),
        },
      ]);
      userRepo.find.mockResolvedValue([]);

      const historial = await service.getHistory('pac-1');
      expect(historial[0].changedByName).toBe('Usuario eliminado');
    });

    it('avisa que no hay historial si el paciente todavía no tiene ficha', async () => {
      await expect(service.getHistory('pac-1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('Estado de fichas para la lista de pacientes', () => {
    beforeEach(() => {
      recordRepo.find.mockResolvedValue([
        {
          patientId: 'pac-1',
          updatedBy: 'psi-1',
          updatedAt: new Date('2026-09-19T10:00:00Z'),
        },
      ]);
    });

    it('a un psicólogo le da el estado solo de sus pacientes asignados', async () => {
      assignmentRepo.find.mockResolvedValue([{ patientId: 'pac-1' }]);

      const estado = await service.getStatusFor({ id: 'psi-1', role: 'psychologist' } as any);

      expect(assignmentRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { psychologistId: 'psi-1', active: true } }),
      );
      expect(estado).toEqual([
        { patientId: 'pac-1', updatedAt: '2026-09-19T10:00:00.000Z', updatedByName: 'Ana Rivas' },
      ]);
    });

    it('no consulta ninguna ficha si el psicólogo no tiene pacientes', async () => {
      assignmentRepo.find.mockResolvedValue([]);

      expect(await service.getStatusFor({ id: 'psi-1', role: 'psychologist' } as any)).toEqual([]);
      // Sin la salida temprana, un `In([])` traería las fichas de TODOS los pacientes.
      expect(recordRepo.find).not.toHaveBeenCalled();
    });

    it('a la coordinación le da todas, sin filtrar por asignación', async () => {
      await service.getStatusFor({ id: 'coord-1', role: 'coordinator' } as any);

      expect(assignmentRepo.find).not.toHaveBeenCalled();
      expect(recordRepo.find).toHaveBeenCalledWith();
    });

    it('no expone el contenido clínico, solo que la ficha existe', async () => {
      assignmentRepo.find.mockResolvedValue([{ patientId: 'pac-1' }]);

      const [estado] = await service.getStatusFor({ id: 'psi-1', role: 'psychologist' } as any);

      expect(Object.keys(estado).sort()).toEqual(['patientId', 'updatedAt', 'updatedByName']);
    });
  });

  describe('Cuestionario de ingreso', () => {
    const RESPUESTAS = {
      motive: 'Perdí dinero que necesitaba',
      motiveOther: null,
      gamblingTypes: ['Apuestas deportivas en línea'],
      gamblingTypesOther: null,
      duration: 'Entre 1 y 3 años',
      triggers: ['Cuando recibo dinero o me pagan'],
      triggersOther: null,
    };

    it('devuelve lo declarado, con la fecha en que se envió la solicitud', async () => {
      registrationRepo.findOne.mockResolvedValue({
        intake: RESPUESTAS,
        createdAt: new Date('2026-09-01T10:00:00Z'),
      });

      const vista = await service.getIntake('pac-1');

      expect(vista.answered).toBe(true);
      expect(vista.submittedAt).toBe('2026-09-01T10:00:00.000Z');
      expect(vista.answers).toEqual(RESPUESTAS);
    });

    it('avisa que no hay nada cuando la solicitud es anterior a estas preguntas', async () => {
      registrationRepo.findOne.mockResolvedValue({
        intake: null,
        createdAt: new Date('2026-08-01T10:00:00Z'),
      });

      expect(await service.getIntake('pac-1')).toEqual({
        answered: false,
        submittedAt: null,
        answers: null,
      });
    });

    it('no falla si el paciente no tiene solicitud de registro', async () => {
      registrationRepo.findOne.mockResolvedValue(null);
      expect((await service.getIntake('pac-1')).answered).toBe(false);
    });

    it('lee la solicitud más reciente, no una antigua', async () => {
      registrationRepo.findOne.mockResolvedValue({
        intake: RESPUESTAS,
        createdAt: new Date('2026-09-01T10:00:00Z'),
      });
      await service.getIntake('pac-1');

      expect(registrationRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ order: { createdAt: 'DESC' } }),
      );
    });
  });

  describe('Anotaciones del seguimiento', () => {
    it('guarda la anotación con su autor y devuelve el nombre resuelto', async () => {
      const nota = await service.addNote('pac-1', 'Llegó al grupo por primera vez.', 'psi-1');

      expect(noteRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ patientId: 'pac-1', authorId: 'psi-1' }),
      );
      expect(nota.authorName).toBe('Ana Rivas');
      expect(nota.createdAt).toBe('2026-09-19T15:00:00.000Z');
    });

    it('lista de la más reciente a la más antigua', async () => {
      noteRepo.find.mockResolvedValue([
        {
          id: 'nota-1',
          patientId: 'pac-1',
          authorId: 'psi-1',
          content: 'Faltó a la sesión.',
          createdAt: new Date('2026-09-19T15:00:00Z'),
        },
      ]);

      const notas = await service.getNotes('pac-1');

      expect(noteRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ order: { createdAt: 'DESC' } }),
      );
      expect(notas[0].authorName).toBe('Ana Rivas');
    });

    it('funciona aunque el paciente todavía no tenga ficha', async () => {
      // Las notas cuelgan del paciente, no de la ficha: se anota desde la primera sesión,
      // antes de que exista la entrevista de ingreso.
      recordRepo.findOne.mockResolvedValue(null);
      await expect(service.getNotes('pac-1')).resolves.toEqual([]);
    });
  });

  describe('CA6 — detonantes hacia el asistente', () => {
    it('entrega el texto de los detonantes cuando la ficha los tiene', async () => {
      recordRepo.findOne.mockResolvedValue({ triggers: 'Días de pago.' });
      expect(await service.getTriggersForAssistant('pac-1')).toBe('Días de pago.');
    });

    it('pide a la base solo la columna de detonantes y ninguna otra', async () => {
      recordRepo.findOne.mockResolvedValue({ triggers: 'Días de pago.' });
      await service.getTriggersForAssistant('pac-1');

      // El resto de la ficha (motivo de consulta, salud) no tiene por qué salir del servicio
      // que alimenta a un modelo de terceros.
      expect(recordRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ select: { triggers: true } }),
      );
    });

    it('devuelve null si no hay ficha, para que el asistente siga sin contexto clínico', async () => {
      recordRepo.findOne.mockResolvedValue(null);
      expect(await service.getTriggersForAssistant('pac-1')).toBeNull();
    });
  });
});
