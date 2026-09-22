import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  AuthUser,
  CLINICAL_RECORD_FIELDS,
  ClinicalRecord as ClinicalRecordDto,
  ClinicalRecordContent,
  ClinicalRecordFieldChange,
  ClinicalNote as ClinicalNoteDto,
  ClinicalRecordStatus,
  IntakeView,
  ClinicalRecordVersion as ClinicalRecordVersionDto,
  ClinicalRecordView,
} from '@stopbet/shared-types';
import { ClinicalRecord } from './entities/clinical-record.entity';
import { ClinicalRecordVersion } from './entities/clinical-record-version.entity';
import { ClinicalNote } from './entities/clinical-note.entity';
import { User } from '../users/entities/user.entity';
import { PatientAssignment } from '../psychologists/entities/patient-assignment.entity';
import { RegistrationRequest } from '../registration/entities/registration-request.entity';
import { SaveClinicalRecordDto } from './dto/save-clinical-record.dto';

const EMPTY_CONTENT = (): ClinicalRecordContent =>
  Object.fromEntries(
    CLINICAL_RECORD_FIELDS.map((f) => [f, '']),
  ) as ClinicalRecordContent;

@Injectable()
export class ClinicalRecordsService {
  constructor(
    @InjectRepository(ClinicalRecord)
    private readonly recordRepo: Repository<ClinicalRecord>,
    @InjectRepository(ClinicalRecordVersion)
    private readonly versionRepo: Repository<ClinicalRecordVersion>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(ClinicalNote)
    private readonly noteRepo: Repository<ClinicalNote>,
    @InjectRepository(PatientAssignment)
    private readonly assignmentRepo: Repository<PatientAssignment>,
    @InjectRepository(RegistrationRequest)
    private readonly registrationRepo: Repository<RegistrationRequest>,
    private readonly dataSource: DataSource,
  ) {}

  // CA1: la primera vez no hay nada escrito, y eso no es un error. Devolver 404 obligaría al
  // panel a tratar "paciente sin ficha" como una falla; acá devuelve los cinco campos en blanco
  // listos para completar.
  async getForPatient(patientId: string): Promise<ClinicalRecordView> {
    const record = await this.recordRepo.findOne({ where: { patientId } });
    if (!record) {
      return { exists: false, record: null, content: EMPTY_CONTENT() };
    }
    return {
      exists: true,
      record: await this.toDto(record),
      content: contentOf(record),
    };
  }

  // CA2: guarda, y dentro de la misma transacción deja la entrada de auditoría del CA4.
  async save(
    patientId: string,
    dto: SaveClinicalRecordDto,
    authorId: string,
  ): Promise<ClinicalRecordDto> {
    const saved = await this.dataSource.transaction(async (manager) => {
      const records = manager.getRepository(ClinicalRecord);
      const versions = manager.getRepository(ClinicalRecordVersion);

      // Bloqueo pesimista: dos psicólogos guardando la misma ficha a la vez calcularían el
      // mismo `versionNumber` y el historial perdería uno de los dos cambios.
      const existing = await records.findOne({
        where: { patientId },
        lock: { mode: 'pessimistic_write' },
      });

      const before: ClinicalRecordContent = existing
        ? contentOf(existing)
        : EMPTY_CONTENT();
      const changedFields = diff(before, dto);

      // Guardar sin tocar nada no es un cambio: si se registrara igual, el historial clínico se
      // llenaría de versiones vacías y encontrar la modificación real costaría más.
      if (existing && changedFields.length === 0) return existing;

      const record = await records.save(
        records.create({
          ...existing,
          patientId,
          ...pickFields(dto),
          updatedBy: authorId,
        }),
      );

      const previas = await versions.count({ where: { recordId: record.id } });
      await versions.save(
        versions.create({
          recordId: record.id,
          versionNumber: previas + 1,
          changedBy: authorId,
          changedFields,
        }),
      );

      return record;
    });

    return this.toDto(saved);
  }

  // CA4: el historial, del cambio más reciente al más antiguo.
  async getHistory(patientId: string): Promise<ClinicalRecordVersionDto[]> {
    const record = await this.recordRepo.findOne({ where: { patientId } });
    if (!record) throw new NotFoundException('Este paciente todavía no tiene ficha clínica');

    const versions = await this.versionRepo.find({
      where: { recordId: record.id },
      order: { versionNumber: 'DESC' },
    });
    const names = await this.namesOf(versions.map((v) => v.changedBy));

    return versions.map((v) => ({
      id: v.id,
      recordId: v.recordId,
      versionNumber: v.versionNumber,
      changedBy: v.changedBy,
      changedByName: names.get(v.changedBy) ?? 'Usuario eliminado',
      changedAt: v.changedAt.toISOString(),
      changedFields: v.changedFields,
    }));
  }

  // Para la lista de «Mis pacientes»: qué pacientes YA tienen ficha. Devuelve solo eso, nunca
  // el contenido, así el panel puede marcar a quién le falta sin traerse cinco relatos
  // clínicos por paciente a una pantalla que es un listado.
  //
  // El alcance se resuelve acá y no con `PatientAccessGuard`, que trabaja sobre un
  // `:patientId` de la ruta y en una lista no hay ninguno: un psicólogo ve el estado de sus
  // asignados y la coordinación, el de todos.
  async getStatusFor(user: AuthUser): Promise<ClinicalRecordStatus[]> {
    let records: ClinicalRecord[];

    if (user.role === 'coordinator') {
      records = await this.recordRepo.find();
    } else {
      const asignaciones = await this.assignmentRepo.find({
        where: { psychologistId: user.id, active: true },
        select: { patientId: true },
      });
      const patientIds = asignaciones.map((a) => a.patientId);
      if (patientIds.length === 0) return [];
      records = await this.recordRepo.find({ where: { patientId: In(patientIds) } });
    }

    const names = await this.namesOf(records.map((r) => r.updatedBy));
    return records.map((r) => ({
      patientId: r.patientId,
      updatedAt: r.updatedAt.toISOString(),
      updatedByName: names.get(r.updatedBy) ?? 'Usuario eliminado',
    }));
  }

  // Lo que el paciente declaró al registrarse (HdU13). Se lee desde `registration_requests` y
  // **no se copia a la ficha**: es material del paciente y se muestra tal cual lo escribió. Si
  // se fusionara con lo que redacta el psicólogo, se perdería el contraste entre lo que el
  // paciente dice de sí mismo y lo que el equipo observa, que es justamente lo que importa.
  async getIntake(patientId: string): Promise<IntakeView> {
    const request = await this.registrationRepo.findOne({
      where: { userId: patientId },
      order: { createdAt: 'DESC' },
    });

    if (!request?.intake) {
      // Distingue «no hay solicitud» de «la solicitud es anterior a estas preguntas»: en los
      // dos casos no hay nada que mostrar, y el panel lo dice en vez de fingir un vacío.
      return { answered: false, submittedAt: null, answers: null };
    }

    return {
      answered: true,
      submittedAt: request.createdAt.toISOString(),
      answers: request.intake,
    };
  }

  async getNotes(patientId: string): Promise<ClinicalNoteDto[]> {
    const notes = await this.noteRepo.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
    const names = await this.namesOf(notes.map((n) => n.authorId));

    return notes.map((n) => ({
      id: n.id,
      patientId: n.patientId,
      authorId: n.authorId,
      authorName: names.get(n.authorId) ?? 'Usuario eliminado',
      content: n.content,
      createdAt: n.createdAt.toISOString(),
    }));
  }

  async addNote(
    patientId: string,
    content: string,
    authorId: string,
  ): Promise<ClinicalNoteDto> {
    const saved = await this.noteRepo.save(
      this.noteRepo.create({ patientId, authorId, content }),
    );
    const names = await this.namesOf([authorId]);

    return {
      id: saved.id,
      patientId: saved.patientId,
      authorId: saved.authorId,
      authorName: names.get(authorId) ?? 'Usuario eliminado',
      content: saved.content,
      createdAt: saved.createdAt.toISOString(),
    };
  }

  // CA6: lo único de la ficha que sale hacia el asistente. Devuelve el texto de los detonantes
  // y nada más: ni nombre, ni RUT, ni teléfono, ni los otros cuatro campos. El motivo de
  // consulta y los antecedentes de salud son material clínico que no tiene por qué viajar a un
  // modelo de terceros para personalizar un saludo.
  async getTriggersForAssistant(patientId: string): Promise<string | null> {
    const record = await this.recordRepo.findOne({
      where: { patientId },
      select: { triggers: true },
    });
    const triggers = record?.triggers?.trim();
    return triggers ? triggers : null;
  }

  private async toDto(record: ClinicalRecord): Promise<ClinicalRecordDto> {
    const names = await this.namesOf([record.updatedBy]);
    return {
      id: record.id,
      patientId: record.patientId,
      ...contentOf(record),
      updatedBy: record.updatedBy,
      updatedByName: names.get(record.updatedBy) ?? 'Usuario eliminado',
      updatedAt: record.updatedAt.toISOString(),
      createdAt: record.createdAt.toISOString(),
    };
  }

  private async namesOf(ids: string[]): Promise<Map<string, string>> {
    const unicos = [...new Set(ids)];
    if (unicos.length === 0) return new Map();
    const users = await this.userRepo.find({
      where: { id: In(unicos) },
      select: { id: true, firstName: true, lastName: true },
    });
    return new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
  }
}

const contentOf = (record: ClinicalRecord): ClinicalRecordContent =>
  Object.fromEntries(
    CLINICAL_RECORD_FIELDS.map((f) => [f, record[f] ?? '']),
  ) as ClinicalRecordContent;

const pickFields = (dto: SaveClinicalRecordDto): ClinicalRecordContent =>
  Object.fromEntries(
    CLINICAL_RECORD_FIELDS.map((f) => [f, dto[f]]),
  ) as ClinicalRecordContent;

const diff = (
  before: ClinicalRecordContent,
  after: SaveClinicalRecordDto,
): ClinicalRecordFieldChange[] =>
  CLINICAL_RECORD_FIELDS.filter((f) => before[f] !== after[f]).map((field) => ({
    field,
    before: before[field],
    after: after[field],
  }));
