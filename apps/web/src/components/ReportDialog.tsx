import { useState, type CSSProperties } from 'react'
import { WIcon, DownloadIcon } from './WIcon'
import { useDialog } from '../hooks/useDialog'
import { api } from '../services/api'
import { generatePatientPDF } from '../utils/generatePatientPDF'
import type { Patient } from '../data/mockData'

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const inputStyle: CSSProperties = {
  height: 40, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)',
  padding: '0 12px', fontSize: 13, color: 'var(--fg1)', width: '100%', boxSizing: 'border-box',
}

// El reporte es de un paciente y a lo largo del tiempo, así que se genera desde su fila en
// «Mis pacientes». Antes era un panel del Resumen con un desplegable para elegir a quién.
export function ReportDialog({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const dialogRef = useDialog<HTMLDivElement>(onClose)
  const [from, setFrom] = useState(() => ymd(new Date(Date.now() - 30 * 86_400_000)))
  const [to, setTo] = useState(() => ymd(new Date()))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rangoInvalido = !from || !to || from > to
  const canExport = !rangoInvalido && !loading

  async function handleExport() {
    setLoading(true)
    setError(null)
    try {
      // El estado de cuotas es complementario: si falla, el reporte sale igual y la
      // sección dice que no hay información, en vez de no generarse.
      const [billing, metrics] = await Promise.all([
        api.getPatientBilling(patient.id).catch(() => null),
        api.getPatientMetrics(patient.id).catch(() => null),
      ])
      await generatePatientPDF(patient, from, to, billing, metrics)
      onClose()
    } catch {
      setError('No se pudo generar el PDF. Intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <button
        aria-label="Cerrar"
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'var(--scrim)', border: 'none', padding: 0, cursor: 'pointer' }}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sb-reporte-titulo"
        tabIndex={-1}
        style={{
          position: 'relative', background: 'var(--surface)', borderRadius: 20, boxShadow: 'var(--shadow-strong)',
          width: 420, maxWidth: '92vw', padding: 24, zIndex: 1,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
          <div style={{ flex: 1 }}>
            <h2 id="sb-reporte-titulo" style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 19, color: 'var(--fg1)' }}>
              Reporte PDF
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--fg2)' }}>
              Evolución, alertas y estado de pagos de <strong style={{ color: 'var(--fg1)' }}>{patient.name}</strong>.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar reporte"
            style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--fg2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <WIcon name="x" size={17} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
          {[{ label: 'Desde', id: 'sb-reporte-desde', val: from, set: setFrom },
            { label: 'Hasta', id: 'sb-reporte-hasta', val: to, set: setTo }].map(f => (
            <div key={f.id} style={{ flex: 1 }}>
              <label htmlFor={f.id} style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--fg2)', marginBottom: 5 }}>{f.label}</label>
              <input id={f.id} type="date" value={f.val} max={ymd(new Date())} onChange={e => f.set(e.target.value)} style={inputStyle} />
            </div>
          ))}
        </div>
        <p role={rangoInvalido ? 'alert' : undefined} style={{ margin: '0 0 18px', minHeight: 17, fontSize: 12, color: rangoInvalido ? 'var(--danger-text)' : 'var(--fg2)' }}>
          {rangoInvalido ? 'La fecha de inicio tiene que ser anterior a la de término.' : 'Por omisión, los últimos 30 días.'}
        </p>

        {error && (
          <div role="alert" style={{ marginBottom: 14, background: 'var(--red-50)', color: 'var(--danger-text)', borderRadius: 10, padding: '10px 12px', fontSize: 13 }}>
            {error}
          </div>
        )}

        <button
          onClick={handleExport}
          disabled={!canExport}
          style={{
            width: '100%', height: 46, borderRadius: 9999, border: 'none',
            background: canExport || loading ? 'var(--primary)' : 'var(--border)',
            color: canExport || loading ? 'var(--fg-on-primary)' : 'var(--fg2)',
            fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15,
            cursor: canExport ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
          }}
        >
          {loading
            ? <><WIcon name="loader" size={18} color="currentColor" style={{ animation: 'sb-spin 0.8s linear infinite' }} /> Generando…</>
            : <><DownloadIcon size={18} color="currentColor" /> Descargar PDF</>}
        </button>
      </div>
    </div>
  )
}
