import jsPDF from 'jspdf'
import type { Patient } from '../data/mockData'

const ORANGE = [232, 136, 58] as const   // #E8883A — primary AJUTER
const DARK   = [42,  38,  36] as const   // #2A2624 — fg1
const GRAY   = [87,  79,  74] as const   // #574F4A — fg2
const RED    = [184, 50,  50] as const   // #B83232 — danger
const CREAM  = [250, 247, 244] as const  // #FAF7F4 — bg
const BORDER = [220, 213, 207] as const  // subtle border

function setColor(doc: jsPDF, rgb: readonly [number, number, number], type: 'fill' | 'text' | 'draw' = 'text') {
  if (type === 'fill')  doc.setFillColor(rgb[0], rgb[1], rgb[2])
  if (type === 'text')  doc.setTextColor(rgb[0], rgb[1], rgb[2])
  if (type === 'draw')  doc.setDrawColor(rgb[0], rgb[1], rgb[2])
}

export function generatePatientPDF(patient: Patient, from: string, to: string): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  let y = 0

  // ── Header band ──────────────────────────────────────────────────────────
  setColor(doc, ORANGE, 'fill')
  doc.rect(0, 0, W, 26, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  setColor(doc, [255, 255, 255], 'text')
  doc.text('StopBet', 14, 11)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Dashboard Clínico — AJUTER', 14, 18)

  doc.setFontSize(8)
  doc.text('Reporte de Seguimiento del Paciente', W - 14, 14, { align: 'right' })

  const now = new Date()
  const dateStr = now.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
  doc.text(`Generado el ${dateStr}`, W - 14, 20, { align: 'right' })
  y = 36

  // ── Section helper ───────────────────────────────────────────────────────
  function sectionTitle(title: string) {
    setColor(doc, DARK, 'text')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(title, 14, y)
    setColor(doc, ORANGE, 'draw')
    doc.setLineWidth(0.6)
    doc.line(14, y + 2, W - 14, y + 2)
    y += 10
  }

  function row(label: string, value: string) {
    setColor(doc, GRAY, 'text')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(label, 14, y)
    setColor(doc, DARK, 'text')
    doc.setFont('helvetica', 'bold')
    doc.text(value, 75, y)
    y += 7
  }

  // ── 1. Datos del paciente ─────────────────────────────────────────────────
  sectionTitle('Datos del Paciente')
  row('Nombre completo:', patient.name)
  row('Sede AJUTER:', patient.sede)
  row('Correo electrónico:', patient.email)
  row('Días de abstinencia:', `${patient.days} días`)
  row('Estado clínico:', patient.status === 'riesgo' ? 'En riesgo' : 'Normal')

  y += 4
  sectionTitle('Período Consultado')
  const fmt = (d: string) => {
    if (!d) return '—'
    const [y, m, day] = d.split('-')
    return `${day}/${m}/${y}`
  }
  row('Desde:', fmt(from))
  row('Hasta:', fmt(to))

  // ── 2. Gráfico de evolución anímica ───────────────────────────────────────
  y += 4
  sectionTitle('Evolución Anímica')

  const evolution = patient.evolution

  if (evolution.length === 0) {
    setColor(doc, GRAY, 'text')
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.text('Sin datos de evolución anímica registrados para este paciente.', 14, y)
    y += 14
  } else {
    const chartX = 18
    const chartY = y
    const chartW = W - 36
    const chartH = 48
    const moodMin = 1
    const moodMax = 5
    const points = evolution.length

    // Background
    setColor(doc, CREAM, 'fill')
    setColor(doc, BORDER, 'draw')
    doc.setLineWidth(0.3)
    doc.rect(chartX, chartY, chartW, chartH, 'FD')

    // Grid lines (5 horizontal, one per mood level)
    doc.setLineWidth(0.15)
    setColor(doc, BORDER, 'draw')
    for (let level = moodMin; level <= moodMax; level++) {
      const gy = chartY + chartH - ((level - moodMin) / (moodMax - moodMin)) * chartH
      doc.line(chartX, gy, chartX + chartW, gy)
      // Y-axis labels
      setColor(doc, GRAY, 'text')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.text(String(level), chartX - 5, gy + 1, { align: 'right' })
    }

    // X-axis labels and line chart
    const xStep = chartW / (points - 1)

    const coords: { x: number; y: number; alert?: boolean }[] = evolution.map((pt, i) => ({
      x: chartX + i * xStep,
      y: chartY + chartH - ((pt.mood - moodMin) / (moodMax - moodMin)) * chartH,
      alert: pt.alert,
    }))

    // Fill area under curve
    setColor(doc, [255, 235, 215], 'fill')
    const areaPath: number[] = []
    coords.forEach(c => areaPath.push(c.x, c.y))
    // Draw filled polygon (area under line)
    doc.setFillColor(255, 235, 215)
    doc.setLineWidth(0)
    if (coords.length >= 2) {
      // Build path manually using lines
      doc.setFillColor(255, 235, 215)
      // Use a simple polygon approximation
      const allX = coords.map(c => c.x)
      const allY = coords.map(c => c.y)
      // jsPDF doesn't have polygon fill natively — use rect approximation per segment
      for (let i = 0; i < coords.length - 1; i++) {
        const x1 = coords[i].x, y1 = coords[i].y
        const x2 = coords[i + 1].x, y2 = coords[i + 1].y
        const bottom = chartY + chartH
        // Draw trapezoid as two triangles via fillable rect (simple fill strip)
        doc.setFillColor(255, 235, 215)
        doc.triangle(x1, y1, x2, y2, x1, bottom, 'F')
        doc.triangle(x2, y2, x2, bottom, x1, bottom, 'F')
      }
    }

    // Main line
    setColor(doc, ORANGE, 'draw')
    doc.setLineWidth(1.2)
    for (let i = 0; i < coords.length - 1; i++) {
      doc.line(coords[i].x, coords[i].y, coords[i + 1].x, coords[i + 1].y)
    }

    // Data points
    coords.forEach((c, i) => {
      if (c.alert) {
        // Panic alert — red filled circle
        setColor(doc, RED, 'fill')
        setColor(doc, RED, 'draw')
        doc.setLineWidth(0.3)
        doc.circle(c.x, c.y, 2.2, 'FD')
      } else {
        // Normal point — orange filled circle
        setColor(doc, ORANGE, 'fill')
        setColor(doc, [255, 255, 255], 'draw')
        doc.setLineWidth(0.5)
        doc.circle(c.x, c.y, 1.8, 'FD')
      }

      // X-axis label
      const label = evolution[i].label
      if (label) {
        setColor(doc, GRAY, 'text')
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6.5)
        doc.text(label, c.x, chartY + chartH + 5, { align: 'center' })
      }
    })

    y = chartY + chartH + 12

    // Legend
    // Orange dot = estado anímico
    setColor(doc, ORANGE, 'fill')
    doc.circle(chartX + 2, y, 1.8, 'F')
    setColor(doc, GRAY, 'text')
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.text('Estado anímico', chartX + 6, y + 0.8)

    // Red dot = alerta de pánico
    setColor(doc, RED, 'fill')
    doc.circle(chartX + 50, y, 1.8, 'F')
    doc.text('Alerta de pánico', chartX + 54, y + 0.8)

    y += 10
  }

  // ── 3. Alertas de pánico ──────────────────────────────────────────────────
  y += 2
  sectionTitle('Alertas de Botón de Pánico')

  // Count box
  const boxX = 14
  const boxW = 80
  const boxH = 22
  setColor(doc, [255, 240, 240], 'fill')
  setColor(doc, RED, 'draw')
  doc.setLineWidth(0.4)
  doc.rect(boxX, y, boxW, boxH, 'FD')

  setColor(doc, RED, 'text')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(26)
  doc.text(String(patient.panicTotal), boxX + boxW / 2, y + 14, { align: 'center' })

  setColor(doc, GRAY, 'text')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('alertas de pánico registradas', boxX + boxW + 8, y + 8)
  doc.text(`en el período consultado`, boxX + boxW + 8, y + 15)

  y += boxH + 10

  // Detail rows if available
  if (patient.alerts.length > 0) {
    setColor(doc, GRAY, 'text')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('Detalle de alertas:', 14, y)
    y += 5

    patient.alerts.forEach(a => {
      const status = a.resolved ? 'Resuelta con IA' : 'Sin resolver'
      setColor(doc, DARK, 'text')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.text(`• ${a.time}`, 18, y)
      setColor(doc, a.resolved ? [79, 142, 79] : [184, 50, 50], 'text')
      doc.text(status, 80, y)
      y += 5.5
    })
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  const footerY = 287
  setColor(doc, BORDER, 'draw')
  doc.setLineWidth(0.3)
  doc.line(14, footerY, W - 14, footerY)

  setColor(doc, GRAY, 'text')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('StopBet · Dashboard Clínico AJUTER · Documento de uso interno', 14, footerY + 5)
  doc.text(`${dateStr}`, W - 14, footerY + 5, { align: 'right' })

  // ── Save ──────────────────────────────────────────────────────────────────
  const filename = `reporte_${patient.name.replace(/\s+/g, '_').toLowerCase()}_${from}_${to}.pdf`
  doc.save(filename)
}
