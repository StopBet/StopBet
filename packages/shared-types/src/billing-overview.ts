// HdU09: el estado de pago de cada paciente, como lo ve el equipo clínico en Finanzas.

export type PatientPaymentState = 'up_to_date' | 'pending' | 'overdue';

export interface PatientBillingRow {
  patientId: string;
  firstName: string;
  lastName: string;
  sedeId: string | null;
  state: PatientPaymentState;
  /** Cuotas vencidas más la del mes en curso, si sigue sin pagar. */
  totalOwedCLP: number;
  /**
   * La cuota sin pagar que vence (o venció) primero. Si está al día, el próximo cobro.
   * `null` si no queda ninguna cuota por delante.
   */
  nextDueDate: string | null;
  /** Días desde que venció la cuota vencida más antigua; 0 si no hay vencidas. */
  daysOverdue: number;
  overdueMonths: number;
}
