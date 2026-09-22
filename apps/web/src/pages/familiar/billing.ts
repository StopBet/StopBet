import type { FamilyBilling, FamilyInvoice } from '../../services/api'

export const BILLING_KEY = ['family', 'billing']

const CLP_FMT = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' })
const MONTH_FMT = new Intl.DateTimeFormat('es-CL', { month: 'long' })
const DUE_FMT = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long' })

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
