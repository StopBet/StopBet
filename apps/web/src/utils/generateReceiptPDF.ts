import jsPDF from 'jspdf'
import type { FamilyPaymentItem, FamilyPaymentResult } from '../services/api'
import { formatCLP, formatMonth, formatPaidDate, formatPaidTime } from '../pages/familiar/billing'

// El comprobante se imprime o se guarda, así que va siempre con la paleta clara de la marca,
// igual que el reporte clínico. Usa la tipografía base del PDF: no hay nada que descargar.
const PRIMARY = [57, 111, 182] as const
const DARK = [58, 57, 57] as const
const GRAY = [107, 106, 106] as const
const BORDER = [226, 226, 214] as const

// jsPDF no sabe dibujar el espacio de no separación que Intl pone en las cifras.
const money = (n: number) => formatCLP(n).replace(/\s/g, ' ')

export function generateReceiptPDF(result: FamilyPaymentResult, patientName: string): void {
  const paid = result.items.filter((i): i is FamilyPaymentItem => i.status === 'authorized')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const M = 18

  doc.setFillColor(...PRIMARY)
  doc.rect(0, 0, W, 34, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text('StopBet', M, 18)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('Comprobante de pago de mensualidad', M, 26)

  let y = 50
  const field = (label: string, value: string) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...GRAY)
    doc.text(label.toUpperCase(), M, y)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...DARK)
    doc.text(value, M, y + 5.5)
    y += 15
  }

  if (result.paidAt) {
    field('Fecha y hora', `${formatPaidDate(result.paidAt)}, ${formatPaidTime(result.paidAt)} h`)
  }
  field('Tratamiento de', patientName)
  if (result.card.cardLast4) {
    field('Medio de pago', `${result.card.cardType ?? 'Tarjeta'} terminada en ${result.card.cardLast4}`)
  }

  y += 2
  doc.setDrawColor(...BORDER)
  doc.line(M, y, W - M, y)
  y += 8

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...GRAY)
  doc.text('CUOTA', M, y)
  doc.text('AUTORIZACIÓN', 100, y)
  doc.text('MONTO', W - M, y, { align: 'right' })
  y += 3
  doc.line(M, y, W - M, y)
  y += 7

  doc.setFontSize(11)
  for (const item of paid) {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...DARK)
    doc.text(formatMonth(item.month), M, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRAY)
    doc.text(item.authorizationCode ?? '—', 100, y)
    doc.setTextColor(...DARK)
    doc.text(money(item.amountCLP), W - M, y, { align: 'right' })
    y += 5
    doc.setFontSize(8.5)
    doc.setTextColor(...GRAY)
    doc.text(`Orden de compra ${item.buyOrder}`, M, y)
    doc.setFontSize(11)
    y += 8
  }

  doc.line(M, y, W - M, y)
  y += 9
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...DARK)
  doc.text('Total pagado', M, y)
  doc.setTextColor(...PRIMARY)
  doc.text(money(result.totalPaidCLP), W - M, y, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...GRAY)
  doc.text(
    'Pago procesado por Transbank (Webpay Oneclick). StopBet no guarda los datos de tu tarjeta.',
    M,
    doc.internal.pageSize.getHeight() - 14,
  )

  const stamp = (result.paidAt ?? new Date().toISOString()).slice(0, 10)
  doc.save(`comprobante-stopbet-${stamp}.pdf`)
}
