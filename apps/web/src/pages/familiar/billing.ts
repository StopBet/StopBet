import type { FamilyBilling, FamilyInvoice, FamilyInvoiceRow } from '../../services/api'

export const BILLING_KEY = ['family', 'billing']

const CLP_FMT = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' })
const MONTH_FMT = new Intl.DateTimeFormat('es-CL', { month: 'long' })
const DUE_FMT = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long' })

// Las horas de los pagos son instantes: se muestran siempre en hora de Chile, no en la del navegador.
const SANTIAGO = 'America/Santiago'
const PAID_DATE_FMT = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: SANTIAGO })
const PAID_TIME_FMT = new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: SANTIAGO })

export const formatPaidDate = (iso: string) => PAID_DATE_FMT.format(new Date(iso))
export const formatPaidTime = (iso: string) => PAID_TIME_FMT.format(new Date(iso))

export const formatCLP = (amount: number) => CLP_FMT.format(amount)

// Las fechas llegan como 'YYYY-MM' y 'YYYY-MM-DD' sin zona. `new Date('2026-09-30')` las lee
// en UTC y en Chile eso cae el día anterior, así que se arman con la hora local.
export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const name = MONTH_FMT.format(new Date(y, m - 1, 1))
  return `${name[0].toUpperCase()}${name.slice(1)} ${y}`
}

export function formatDueDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return DUE_FMT.format(new Date(y, m - 1, d))
}

// Si hay cuotas vencidas se pagan esas; si está al día, la próxima por adelantado.
export function amountDue(billing: FamilyBilling): { items: FamilyInvoice[]; total: number } {
  if (billing.overdueInvoices.length > 0) {
    return { items: billing.overdueInvoices, total: billing.totalOwedCLP }
  }
  if (billing.nextInvoice) {
    return { items: [billing.nextInvoice], total: billing.nextInvoice.amountCLP }
  }
  return { items: [], total: 0 }
}

// Lo que el familiar puede seleccionar: todo lo que no está pagado (CA4).
export const unpaidInvoices = (billing: FamilyBilling): FamilyInvoiceRow[] =>
  billing.invoices.filter((i) => i.status !== 'paid')

// Con cuotas vencidas, esas vienen marcadas; al día, se ofrece solo la próxima por adelantado (CA3).
export function defaultSelection(billing: FamilyBilling): string[] {
  const unpaid = unpaidInvoices(billing)
  const overdue = unpaid.filter((i) => i.status === 'overdue')
  if (overdue.length > 0) return overdue.map((i) => i.id)
  return unpaid.length > 0 ? [unpaid[0].id] : []
}
