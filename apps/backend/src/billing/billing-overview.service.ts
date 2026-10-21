import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { AuthUser, PatientBillingRow } from '@stopbet/shared-types';
import { Invoice } from './entities/invoice.entity';
import { User } from '../users/entities/user.entity';
import { PatientAssignment } from '../psychologists/entities/patient-assignment.entity';
import { todayInChile } from '../common/chile-date';
import { summarizePayments } from './patient-payment-state';

@Injectable()
export class BillingOverviewService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(PatientAssignment)
    private readonly assignmentRepo: Repository<PatientAssignment>,
  ) {}

  // HdU09 CA1. Mismo alcance que `GET /users/patients`: el psicólogo ve solo a sus asignados y la
  // coordinación a todos. Quien no tiene ninguna cuota no aparece: no hay un estado de pago que
  // mostrar, y si nadie tiene, la página explica que aún no hay pagos (CA3).
  async listPatients(viewer: AuthUser): Promise<PatientBillingRow[]> {
    let assignedIds: string[] | null = null;
    if (viewer.role === 'psychologist') {
      const assignments = await this.assignmentRepo.find({
        where: { psychologistId: viewer.id, active: true },
        select: { patientId: true },
      });
      assignedIds = assignments.map((a) => a.patientId);
      if (assignedIds.length === 0) return [];
    }

    // Postulantes sin aprobar tienen rol `patient` pero no son pacientes (ver `listPatients` de
    // users). `onboardingStatus` es nullable en las cuentas antiguas: de ahí las dos ramas.
    const base = assignedIds ? { role: 'patient' as const, id: In(assignedIds) } : { role: 'patient' as const };
    const patients = await this.userRepo.find({
      where: [
        { ...base, onboardingStatus: Not('approval_pending' as const) },
        { ...base, onboardingStatus: IsNull() },
      ],
      select: { id: true, firstName: true, lastName: true, sedeId: true },
    });
    if (patients.length === 0) return [];

    const invoices = await this.invoiceRepo.find({
      where: { userId: In(patients.map((p) => p.id)) },
      select: { userId: true, month: true, amountCLP: true, status: true, dueDate: true },
    });
    const byPatient = new Map<string, Invoice[]>();
    for (const invoice of invoices) {
      const list = byPatient.get(invoice.userId) ?? [];
      list.push(invoice);
      byPatient.set(invoice.userId, list);
    }

    const today = todayInChile();
    const rows: PatientBillingRow[] = [];
    for (const p of patients) {
      const own = byPatient.get(p.id);
      if (!own) continue;
      rows.push({
        patientId: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        sedeId: p.sedeId ?? null,
        ...summarizePayments(own, today),
      });
    }

    // CA2: los más atrasados primero. Se ordena acá y no solo al filtrar, para que la tabla sin
    // filtro también abra con quien necesita seguimiento.
    const weight = { overdue: 0, pending: 1, up_to_date: 2 } as const;
    return rows.sort(
      (a, b) =>
        weight[a.state] - weight[b.state] ||
        b.daysOverdue - a.daysOverdue ||
        `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'es'),
    );
  }
}
