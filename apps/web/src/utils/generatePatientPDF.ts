import jsPDF from 'jspdf'
import type { Patient } from '../data/mockData'
import { ALERT_STATUS, needsAttention } from './alertStatus'
import type { BillingStatus, PatientMetrics } from '../services/api'
import { isBrandActive, isDarkActive } from './theme'

// Las tipografías del manual. Vite devuelve la URL del asset, así que no entran al
// bundle inicial: se descargan solo cuando alguien exporta un reporte.
import chillaxBold from '../styles/fonts/Chillax-Bold.ttf'
import satoshiRegular from '../styles/fonts/Satoshi-Regular.ttf'
import satoshiBold from '../styles/fonts/Satoshi-Bold.ttf'
import isotipo from '../assets/isotipo-blanco.png'

// jsPDF necesita RGB numérico, así que los tokens del tema se leen del CSS y se
// convierten una vez por documento. Escribirlos a mano es lo que dejó este informe
// con la paleta naranja de AJUTER meses después de que el panel pasara al azul StopBet.
type Rgb = readonly [number, number, number]

const FALLBACK: Record<string, Rgb> = {
  '--primary':       [57, 111, 182],
  '--primary-hover': [45, 90, 158],
  '--fg1':           [58, 57, 57],
  '--fg2':           [107, 106, 106],
  '--danger':        [184, 50, 50],
  '--bg':            [244, 244, 233],
  '--border-200':    [226, 226, 214],
  '--teal-50':       [236, 243, 250],
  '--secondary-text':[91, 115, 36],
  '--sage-50':       [242, 247, 226],
  '--red-50':        [252, 236, 236],
}

function hexToRgb(hex: string): Rgb | null {
  const h = hex.trim().replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ] as const
}

// El informe se imprime sobre papel blanco: siempre va con la paleta CLARA. Con el panel
// en modo oscuro, leer el CSS devolvería texto casi blanco y fondos oscuros, así que en ese
// caso se usa la paleta de respaldo, que es la clara de la marca. Con los colores de AJUTER
// también: que el informe clínico lleve la marca de la institución no está decidido.
function token(name: string): Rgb {
  if (typeof window === 'undefined' || isDarkActive() || isBrandActive()) return FALLBACK[name]
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name)
  return hexToRgb(raw) ?? FALLBACK[name]
}

// Se cargan al generar cada documento, no al importar el módulo: si se leyeran una sola vez,
// un cambio de tema después de abrir el panel dejaría el informe con la paleta vieja.
let PRIMARY: Rgb, DARK: Rgb, GRAY: Rgb, RED: Rgb, BORDER: Rgb
let TEAL_50: Rgb, GREEN_TXT: Rgb, SAGE_50: Rgb, RED_50: Rgb

function cargarPaleta() {
  PRIMARY   = token('--primary')
  DARK      = token('--fg1')
  GRAY      = token('--fg2')
  RED       = token('--danger')
  BORDER    = token('--border-200')
  TEAL_50   = token('--teal-50')
  GREEN_TXT = token('--secondary-text')
  SAGE_50   = token('--sage-50')
  RED_50    = token('--red-50')
}
const WHITE     = [255, 255, 255] as const
const NEUTRAL   = [245, 245, 240] as const

// El detalle completo de alertas vive en el panel; el informe muestra las recientes.
const MAX_ALERTS = 3

// Regla del cliente: el paciente pierde el acceso a la app recién a los 3 meses de no
// pago. Antes de eso hay deuda, pero no es una urgencia. Pintarla de rojo desde el
// primer mes le enseña al psicólogo a ignorar el rojo, que está reservado a la crisis.
// Ojo: hoy NADA suspende por mora automáticamente; ver docs/ASUNCIONES-PENDIENTES.md.
const MESES_PARA_PERDER_ACCESO = 3

// ── Tipografías de marca ────────────────────────────────────────────────────
// Si la descarga falla, el informe sale en Helvetica en vez de no salir: un reporte
// clínico con la fuente equivocada sigue sirviendo, uno que no se genera no.
type Family = 'heading' | 'body'
let fontsReady = false

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 8192) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 8192))
  }
  return btoa(bin)
}

async function loadBrandFonts(doc: jsPDF): Promise<boolean> {
  const defs: Array<[string, string, string, string]> = [
    [chillaxBold,    'Chillax-Bold.ttf',    'Chillax', 'bold'],
    [satoshiRegular, 'Satoshi-Regular.ttf', 'Satoshi', 'normal'],
    [satoshiBold,    'Satoshi-Bold.ttf',    'Satoshi', 'bold'],
  ]
  try {
    for (const [url, file, family, style] of defs) {
      const res = await fetch(url)
      if (!res.ok) return false
      doc.addFileToVFS(file, bufferToBase64(await res.arrayBuffer()))
      doc.addFont(file, family, style)
    }
    return true
  } catch {
    return false
  }
}

async function loadIsotipo(): Promise<string | null> {
  try {
    const res = await fetch(isotipo)
    if (!res.ok) return null
    return 'data:image/png;base64,' + bufferToBase64(await res.arrayBuffer())
  } catch {
    return null
  }
}

function setFont(doc: jsPDF, family: Family, bold = false) {
  if (!fontsReady) {
    doc.setFont('helvetica', bold || family === 'heading' ? 'bold' : 'normal')
    return
  }
  if (family === 'heading') doc.setFont('Chillax', 'bold')
  else doc.setFont('Satoshi', bold ? 'bold' : 'normal')
}

function setColor(doc: jsPDF, rgb: Rgb, type: 'fill' | 'text' | 'draw' = 'text') {
  if (type === 'fill') doc.setFillColor(rgb[0], rgb[1], rgb[2])
  if (type === 'text') doc.setTextColor(rgb[0], rgb[1], rgb[2])
  if (type === 'draw') doc.setDrawColor(rgb[0], rgb[1], rgb[2])
}

function chipWidth(doc: jsPDF, text: string): number {
  setFont(doc, 'body', true)
  doc.setFontSize(8)
  return doc.getTextWidth(text) + 7
}

// Chip con fondo suave y texto oscuro, igual que los estados del panel.
function chip(doc: jsPDF, x: number, y: number, text: string, bg: Rgb, fg: Rgb): number {
  const w = chipWidth(doc, text)
  setColor(doc, bg, 'fill')
  doc.roundedRect(x, y, w, 6.2, 3.1, 3.1, 'F')
  setColor(doc, fg, 'text')
  doc.text(text, x + w / 2, y + 4.2, { align: 'center' })
  return w
}

export async function generatePatientPDF(
  patient: Patient,
  from: string,
  to: string,
  billing?: BillingStatus | null,
  metrics?: PatientMetrics | null,
): Promise<void> {
  cargarPaleta()
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  fontsReady = await loadBrandFonts(doc)
  const mark = await loadIsotipo()

  const W = 210
  const M = 16               // margen lateral
  const CW = W - M * 2       // ancho útil
  let y = 0

  const now = new Date()
  const dateStr = now.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
  const clp = (n: number) => '$' + n.toLocaleString('es-CL')
  const fmtISO = (d: string) => {
    const [yy, mm, dd] = d.split('-')
    return `${dd}-${mm}-${yy}`
  }
  const fmt = (d: string) => {
    if (!d) return '-'
    const [yy, mm, dd] = d.split('-')
    return `${dd}-${mm}-${yy}`
  }

  // ── Cabecera ──────────────────────────────────────────────────────────────
  setColor(doc, PRIMARY, 'fill')
  doc.rect(0, 0, W, 28, 'F')

  // El isotipo es blanco: va sobre el azul de marca, nunca sobre el crema.
  const markSize = 11
  const textX = mark ? M + markSize + 4 : M
  if (mark) doc.addImage(mark, 'PNG', M, 8.5, markSize, markSize * (388 / 396))

  setFont(doc, 'heading')
  doc.setFontSize(17)
  setColor(doc, WHITE, 'text')
  doc.text('StopBet', textX, 14)

  setFont(doc, 'body')
  doc.setFontSize(8.5)
  doc.text('Panel clínico', textX, 20)

  setFont(doc, 'body', true)
  doc.setFontSize(9)
  doc.text('Reporte de seguimiento', W - M, 13, { align: 'right' })
  setFont(doc, 'body')
  doc.setFontSize(8)
  doc.text(dateStr, W - M, 19.5, { align: 'right' })

  // ── Identificación del paciente ───────────────────────────────────────────
  y = 42
  setFont(doc, 'heading')
  doc.setFontSize(19)
  setColor(doc, DARK, 'text')
  doc.text(patient.name, M, y)

  // Chips de sede y estado, alineados a la derecha del nombre
  const enRiesgo = patient.status === 'riesgo'
  const estadoTxt = enRiesgo ? 'En riesgo' : 'Normal'
  const estadoW = chipWidth(doc, estadoTxt)
  const sedeW = chipWidth(doc, patient.sede)
  chip(doc, W - M - estadoW, y - 4.5, estadoTxt,
       enRiesgo ? RED_50 : SAGE_50, enRiesgo ? RED : GREEN_TXT)
  chip(doc, W - M - estadoW - sedeW - 3, y - 4.5, patient.sede, TEAL_50, PRIMARY)

  y += 6.5
  setFont(doc, 'body')
  doc.setFontSize(9)
  setColor(doc, GRAY, 'text')
  doc.text(patient.email, M, y)

  y += 5.5
  doc.setFontSize(8.5)
  doc.text(`Período del reporte:  ${fmt(from)}  -  ${fmt(to)}`, M, y)

  // ── Tarjetas de métricas ──────────────────────────────────────────────────
  y += 8
  const cards: Array<{ value: string; label: string; alarm?: boolean }> = [
    { value: String(patient.days),             label: 'días sin apostar' },
    // Las dos cifras salen de /metrics (últimos 30 días, lo mismo que muestra la ficha) y la
    // etiqueta dice eso. Antes «check-ins registrados» contaba los puntos del gráfico, que
    // agrupa por SEMANA: a una paciente con 28 check-ins le ponía 5. Y «alertas del período»
    // era el total histórico. Sin métricas, se dice el total histórico con su nombre real.
    metrics
      ? { value: String(metrics.panicCount), label: 'alertas en los últimos 30 días', alarm: metrics.panicCount > 0 }
      : { value: String(patient.panicTotal), label: 'alertas registradas en total', alarm: patient.panicTotal > 0 },
    metrics
      ? { value: String(metrics.totalCheckIns), label: 'check-ins en los últimos 30 días' }
      : { value: '-', label: 'check-ins (sin datos)' },
  ]
  const gap = 4
  const cardW = (CW - gap * (cards.length - 1)) / cards.length
  const cardH = 25

  cards.forEach((c, i) => {
    const x = M + i * (cardW + gap)
    setColor(doc, WHITE, 'fill')
    setColor(doc, BORDER, 'draw')
    doc.setLineWidth(0.3)
    doc.roundedRect(x, y, cardW, cardH, 2.5, 2.5, 'FD')

    setFont(doc, 'heading')
    doc.setFontSize(18)
    setColor(doc, c.alarm ? RED : PRIMARY, 'text')
    doc.text(c.value, x + 5, y + 12.5)

    setFont(doc, 'body')
    doc.setFontSize(7.5)
    setColor(doc, GRAY, 'text')
    doc.text(c.label, x + 5, y + 19, { maxWidth: cardW - 9 })
  })
  y += cardH + 15

  // Título de sección sin subrayado: el peso tipográfico ya marca la jerarquía.
  function sectionTitle(title: string, x: number) {
    setFont(doc, 'heading')
    doc.setFontSize(12)
    setColor(doc, DARK, 'text')
    doc.text(title, x, y)
    y += 8
  }

  function emptyBox(text: string, h: number, x: number, w: number) {
    setColor(doc, BORDER, 'draw')
    doc.setLineWidth(0.3)
    doc.roundedRect(x, y, w, h, 2.5, 2.5, 'D')
    setFont(doc, 'body')
    doc.setFontSize(8)
    setColor(doc, GRAY, 'text')
    doc.text(text, x + w / 2, y + h / 2 + 1.2, { align: 'center', maxWidth: w - 8 })
    y += h + 6
  }

  // ── Dos columnas: la curva a la izquierda, las alertas a la derecha ───────
  const colGap = 7
  const chartColW = (CW - colGap) * 0.62
  const alertColW = CW - colGap - chartColW
  const alertColX = M + chartColW + colGap
  const topY = y

  // Columna izquierda ── evolución del ánimo
  sectionTitle('Evolución del ánimo', M)
  const evolution = patient.evolution
  if (evolution.length === 0) {
    emptyBox('Sin check-ins en este período.', 46, M, chartColW)
  } else {
    const chartX = M + 7
    const chartY = y
    const chartW = chartColW - 7
    const chartH = 46
    const MOOD_MIN = 1
    const MOOD_MAX = 5

    doc.setLineWidth(0.15)
    for (let level = MOOD_MIN; level <= MOOD_MAX; level++) {
      const gy = chartY + chartH - ((level - MOOD_MIN) / (MOOD_MAX - MOOD_MIN)) * chartH
      setColor(doc, BORDER, 'draw')
      doc.line(chartX, gy, chartX + chartW, gy)
      setFont(doc, 'body')
      doc.setFontSize(6.5)
      setColor(doc, GRAY, 'text')
      doc.text(String(level), chartX - 2.5, gy + 1, { align: 'right' })
    }

    const n = evolution.length
    const xStep = n > 1 ? chartW / (n - 1) : 0
    const coords = evolution.map((pt, i2) => ({
      x: n > 1 ? chartX + i2 * xStep : chartX + chartW / 2,
      y: chartY + chartH - ((pt.mood - MOOD_MIN) / (MOOD_MAX - MOOD_MIN)) * chartH,
      alert: pt.alert,
    }))

    if (coords.length >= 2) {
      setColor(doc, TEAL_50, 'fill')
      const bottom = chartY + chartH
      for (let i2 = 0; i2 < coords.length - 1; i2++) {
        const a = coords[i2], b = coords[i2 + 1]
        doc.triangle(a.x, a.y, b.x, b.y, a.x, bottom, 'F')
        doc.triangle(b.x, b.y, b.x, bottom, a.x, bottom, 'F')
      }
    }

    setColor(doc, PRIMARY, 'draw')
    doc.setLineWidth(0.9)
    for (let i2 = 0; i2 < coords.length - 1; i2++) {
      doc.line(coords[i2].x, coords[i2].y, coords[i2 + 1].x, coords[i2 + 1].y)
    }

    // En media columna las fechas se pisan antes: se muestran menos.
    const every = n > 8 ? Math.ceil(n / 6) : 1
    coords.forEach((c, i2) => {
      if (c.alert) {
        setColor(doc, RED, 'fill'); setColor(doc, WHITE, 'draw')
        doc.setLineWidth(0.5)
        doc.circle(c.x, c.y, 1.7, 'FD')
      } else {
        setColor(doc, WHITE, 'fill'); setColor(doc, PRIMARY, 'draw')
        doc.setLineWidth(0.55)
        doc.circle(c.x, c.y, 1.25, 'FD')
      }
      const label = evolution[i2].label
      if (label && (i2 % every === 0 || i2 === n - 1)) {
        setFont(doc, 'body')
        doc.setFontSize(6)
        setColor(doc, GRAY, 'text')
        doc.text(label, c.x, chartY + chartH + 4.5, { align: 'center' })
      }
    })

    y = chartY + chartH + 10

    setColor(doc, WHITE, 'fill'); setColor(doc, PRIMARY, 'draw')
    doc.setLineWidth(0.55)
    doc.circle(chartX + 1.2, y, 1.25, 'FD')
    setFont(doc, 'body')
    doc.setFontSize(6.8)
    setColor(doc, GRAY, 'text')
    doc.text('Check-in', chartX + 4.2, y + 0.8)
    const legendGap = 4.2 + doc.getTextWidth('Check-in') + 7
    setColor(doc, RED, 'fill'); setColor(doc, WHITE, 'draw')
    doc.setLineWidth(0.5)
    doc.circle(chartX + legendGap, y, 1.7, 'FD')
    setColor(doc, GRAY, 'text')
    doc.text('Día con alerta', chartX + legendGap + 3.6, y + 0.8)
    y += 6
  }
  const leftEnd = y

  // Columna derecha ── alertas de pánico
  y = topY
  sectionTitle('Alertas de pánico', alertColX)

  if (patient.alerts.length === 0) {
    emptyBox('Sin alertas en este período.', 22, alertColX, alertColW)
  } else {
    // Solo las más recientes: el detalle completo vive en el panel, y la tarjeta de
    // arriba ya dice cuántas hubo en total.
    const shown = patient.alerts.slice(0, MAX_ALERTS)
    shown.forEach(a => {
      setColor(doc, WHITE, 'fill')
      setColor(doc, BORDER, 'draw')
      doc.setLineWidth(0.3)
      doc.roundedRect(alertColX, y, alertColW, 15, 2.5, 2.5, 'FD')

      setFont(doc, 'body', true)
      doc.setFontSize(8)
      setColor(doc, DARK, 'text')
      doc.text(a.time, alertColX + 4, y + 5.5, { maxWidth: alertColW - 8 })

      const atiende = needsAttention(a.status)
      const resp = a.status === 'responded'
      chip(doc, alertColX + 4, y + 7.6, ALERT_STATUS[a.status].label,
           atiende ? RED_50 : resp ? TEAL_50 : NEUTRAL,
           atiende ? RED : resp ? PRIMARY : GRAY)
      y += 18
    })

    const rest = patient.alerts.length - shown.length
    if (rest > 0) {
      setFont(doc, 'body')
      doc.setFontSize(6.8)
      setColor(doc, GRAY, 'text')
      doc.text(`+ ${rest} ${rest === 1 ? 'anterior' : 'anteriores'} en el panel`, alertColX, y + 0.5)
      y += 5
    }
  }

  y = Math.max(leftEnd, y) + 12

  // ── Estado de pagos ───────────────────────────────────────────────────────
  sectionTitle('Estado de pagos', M)

  if (!billing) {
    emptyBox('Sin información de pagos para este paciente.', 20, M, CW)
  } else {
    const alDia = billing.overdueMonths === 0
    const critico = billing.overdueMonths >= MESES_PARA_PERDER_ACCESO
    const boxH = 26
    setColor(doc, WHITE, 'fill')
    setColor(doc, critico ? RED : BORDER, 'draw')
    doc.setLineWidth(0.3)
    doc.roundedRect(M, y, CW, boxH, 2.5, 2.5, 'FD')

    const estadoTxt2 = alDia
      ? 'Al día'
      : `${billing.overdueMonths} ${billing.overdueMonths === 1 ? 'mes pendiente' : 'meses pendientes'}`
    chip(doc, M + 5, y + 5, estadoTxt2,
         alDia ? SAGE_50 : critico ? RED_50 : NEUTRAL,
         alDia ? GREEN_TXT : critico ? RED : DARK)

    setFont(doc, 'body')
    doc.setFontSize(8)
    setColor(doc, GRAY, 'text')
    if (alDia) {
      doc.text(
        billing.nextPaymentDate
          ? `Próximo pago: ${fmtISO(billing.nextPaymentDate)}`
          : 'Sin cobros pendientes.',
        M + 5, y + 18,
      )
    } else {
      setFont(doc, 'heading')
      doc.setFontSize(13)
      setColor(doc, critico ? RED : DARK, 'text')
      doc.text(clp(billing.totalOwedCLP), M + 5, y + 20)

      setFont(doc, 'body')
      doc.setFontSize(8)
      setColor(doc, GRAY, 'text')
      const desde = billing.firstOverdueDate ? `desde el ${fmtISO(billing.firstOverdueDate)}` : ''
      doc.text(`adeudado ${desde} · ${billing.daysOverdue} días`, M + 5 + doc.getTextWidth(clp(billing.totalOwedCLP)) + 16, y + 20)

      // Lo que el psicólogo necesita saber: cuánto margen queda antes de que el
      // paciente quede fuera de la app. No aplica si ya está suspendido. Y los dos
      // textos ocupaban la misma línea, así que se pisaban.
      const faltan = MESES_PARA_PERDER_ACCESO - billing.overdueMonths
      if (faltan > 0 && billing.accountStatus !== 'suspended') {
        setFont(doc, 'body')
        doc.setFontSize(7.5)
        setColor(doc, GRAY, 'text')
        doc.text(
          `Pierde el acceso a la app a los ${MESES_PARA_PERDER_ACCESO} meses: ${faltan === 1 ? 'queda 1 mes' : `quedan ${faltan} meses`}.`,
          M + CW - 5, y + 20, { align: 'right', maxWidth: CW / 2 - 6 },
        )
      }
    }

    // El plan es mensual y del mismo monto para todos; el detalle por cuota
    // solo aporta cuando hay mora.
    if (!alDia && billing.overdueInvoices.length > 0) {
      const meses = billing.overdueInvoices.map(i2 => i2.month).join(' · ')
      setFont(doc, 'body')
      doc.setFontSize(7.5)
      setColor(doc, GRAY, 'text')
      doc.text(`Cuotas impagas: ${meses}`, M + CW - 5, y + 10, { align: 'right', maxWidth: CW / 2 })
    }

    if (billing.accountStatus === 'suspended') {
      setFont(doc, 'body', true)
      doc.setFontSize(7.5)
      setColor(doc, RED, 'text')
      doc.text('Cuenta suspendida: el paciente no puede entrar a la app.',
               M + CW - 5, y + 20, { align: 'right', maxWidth: CW / 2 - 6 })
    }

    y += boxH + 10
  }

  // ── Pie ───────────────────────────────────────────────────────────────────
  const footerY = 284
  setColor(doc, BORDER, 'draw')
  doc.setLineWidth(0.3)
  doc.line(M, footerY, W - M, footerY)

  setFont(doc, 'body')
  doc.setFontSize(7)
  setColor(doc, GRAY, 'text')
  doc.text('StopBet · Panel clínico · Documento de uso interno', M, footerY + 5)
  doc.text(dateStr, W - M, footerY + 5, { align: 'right' })

  const filename = `reporte_${patient.name.replace(/\s+/g, '_').toLowerCase()}_${from}_${to}.pdf`
  doc.save(filename)
}
