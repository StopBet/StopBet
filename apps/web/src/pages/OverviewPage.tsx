import { useState } from 'react'
import { WIcon, DownloadIcon } from '../components/WIcon'
import { MetricCard } from '../components/MetricCard'
import { MoodChart } from '../components/MoodChart'
import { PATIENTS, TODAY_ALERTS, SEDES, type Patient } from '../data/mockData'
import { generatePatientPDF } from '../utils/generatePatientPDF'

/* ── Helpers ─────────────────────────────────────────── */
function StatusBadge({ status }: { status: 'normal' | 'riesgo' }) {
  const map = {
    normal: { bg: 'var(--sage-50)', fg: 'var(--sage-500)', label: 'Normal' },
    riesgo: { bg: 'var(--red-50)',  fg: 'var(--danger)',   label: 'En riesgo' },
  }
  const s = map[status]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', background: s.bg, color: s.fg, borderRadius: 9999, padding: '5px 12px', fontSize: 12, fontWeight: 700 }}>
      {s.label}
    </span>
  )
}

function ProgressBar({ value, max = 90, color = 'var(--primary)' }: { value: number; max?: number; color?: string }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div style={{ height: 6, width: 64, background: 'var(--border)', borderRadius: 9999, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 9999 }} />
    </div>
  )
}

/* ── Patient Drawer ──────────────────────────────────── */
function PatientDrawer({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const [tab, setTab] = useState<'evolucion' | 'alertas' | 'sesiones' | 'editar'>('evolucion')
  const tabs = [
    { id: 'evolucion' as const, label: 'Evolución' },
    { id: 'alertas' as const,   label: 'Alertas' },
    { id: 'sesiones' as const,  label: 'Sesiones IA' },
    { id: 'editar' as const,    label: 'Editar' },
  ]

  const StatRow = ({ icon, label, value, color }: { icon: string; label: string; value: string | number; color?: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: 'var(--teal-50)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <WIcon name={icon} size={17} />
      </div>
      <span style={{ flex: 1, fontSize: 13.5, color: 'var(--fg2)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16, color: color ?? 'var(--fg1)' }}>{value}</span>
    </div>
  )

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(30,45,44,0.32)', zIndex: 40, animation: 'sb-scrim-in 0.24s ease' }}
      />
      <div style={{
        position: 'fixed', top: 0, right: 0, height: '100vh', width: 480,
        maxWidth: '92vw', background: 'var(--surface)', boxShadow: 'var(--shadow-strong)',
        zIndex: 41, display: 'flex', flexDirection: 'column',
        animation: 'sb-drawer-in 0.42s cubic-bezier(0.22,0.61,0.36,1)',
      }}>
        {/* Header */}
        <div style={{ padding: '24px 24px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', flexShrink: 0, background: 'var(--teal-50)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 24 }}>
              {patient.initials}
            </div>
            <div style={{ flex: 1, paddingTop: 4 }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 22, color: 'var(--fg1)', lineHeight: 1.15 }}>{patient.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <span style={{ background: 'var(--teal-50)', color: 'var(--primary)', borderRadius: 9999, padding: '3px 11px', fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>{patient.days} días</span>
                <span style={{ fontSize: 12.5, color: 'var(--fg2)' }}>{patient.email}</span>
              </div>
            </div>
            <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--fg2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <WIcon name="x" size={18} />
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginTop: 20, borderBottom: '1px solid var(--border)' }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                background: 'none', border: 'none', padding: '10px 12px', cursor: 'pointer',
                fontSize: 13.5, fontWeight: tab === t.id ? 700 : 500,
                fontFamily: 'var(--font-body)',
                color: tab === t.id ? 'var(--primary)' : 'var(--fg2)',
                borderBottom: tab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
                marginBottom: -1,
              }}>{t.label}</button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {tab === 'evolucion' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 10 }}>
                <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16, color: 'var(--fg1)' }}>Estado emocional</h3>
                <span style={{ fontSize: 12, color: 'var(--fg2)' }}>Últimas 4 semanas</span>
              </div>
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 12px 6px', marginBottom: 12 }}>
                <MoodChart data={patient.evolution} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18, fontSize: 12, color: 'var(--fg2)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 14, height: 3, borderRadius: 2, background: 'var(--primary)', display: 'inline-block' }} /> Estado anímico
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--danger)', display: 'inline-block' }} /> Alerta de pánico
                </span>
              </div>
              <StatRow icon="triangle-alert" label="Total alertas de pánico" value={patient.panicTotal} color={patient.panicTotal > 0 ? 'var(--danger)' : undefined} />
              <StatRow icon="activity" label="Promedio de estado" value={`${patient.moodAvg}/5`} />
              <StatRow icon="clock" label="Último check emocional" value={patient.lastCheck} />
              <div style={{ display: 'flex', gap: 12, marginTop: 22 }}>
                <button style={{ flex: 1, height: 44, borderRadius: 9999, border: '1.5px solid var(--danger)', background: 'var(--surface)', color: 'var(--danger)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'var(--font-heading)' }}>
                  Registrar recaída
                </button>
                <button style={{ flex: 1, height: 44, borderRadius: 9999, border: 'none', background: 'none', color: 'var(--primary)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                  Editar fecha de abstinencia
                </button>
              </div>
            </>
          )}

          {tab === 'alertas' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(patient.alerts.length ? patient.alerts : [{ time: 'Sin alertas registradas', rel: '', resolved: true }]).map((a, i) => (
                <div key={i} style={{ background: a.resolved ? 'var(--sage-50)' : 'var(--red-50)', borderRadius: 12, borderLeft: `3px solid ${a.resolved ? 'var(--sage-500)' : 'var(--danger)'}`, padding: '13px 15px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13.5, color: 'var(--fg1)' }}>{a.time}</span>
                    {a.rel && <span style={{ fontSize: 12, color: 'var(--fg2)' }}>{a.rel}</span>}
                  </div>
                  {a.rel && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 9, color: a.resolved ? 'var(--sage-500)' : 'var(--danger)', fontSize: 12, fontWeight: 700 }}>
                      <WIcon name={a.resolved ? 'circle-check' : 'circle-alert'} size={13} />
                      {a.resolved ? 'Contención con IA' : 'Sin resolver'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === 'sesiones' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(patient.sessions.length ? patient.sessions : [{ date: 'Sin sesiones IA registradas', summary: 'Este paciente aún no ha usado el asistente virtual.' }]).map((s, i) => (
                <div key={i} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <WIcon name="message-circle" size={16} color="var(--primary)" />
                    <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13.5, color: 'var(--fg1)' }}>{s.date}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--fg2)', lineHeight: 1.5 }}>{s.summary}</p>
                </div>
              ))}
            </div>
          )}

          {tab === 'editar' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[['Nombre completo', patient.name], ['Correo', patient.email], ['Sede', patient.sede]].map(([l, v]) => (
                <div key={l}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg2)', display: 'block', marginBottom: 6 }}>{l}</label>
                  <input defaultValue={v} style={{ height: 40, width: '100%', boxSizing: 'border-box', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', padding: '0 12px', fontSize: 13.5, color: 'var(--fg1)', outline: 'none' }} />
                </div>
              ))}
              <button style={{ marginTop: 4, height: 46, borderRadius: 9999, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14.5, cursor: 'pointer' }}>
                Guardar cambios
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

/* ── Patient Table ───────────────────────────────────── */
function PatientTable({ onOpen }: { onOpen: (p: Patient) => void }) {
  const [q, setQ] = useState('')
  const [sedeFilter, setSedeFilter] = useState('Todas')

  const rows = PATIENTS.filter(p => {
    const matchName = p.name.toLowerCase().includes(q.toLowerCase())
    const matchSede = sedeFilter === 'Todas' || p.sede === sedeFilter
    return matchName && matchSede
  })

  const Head = ({ label }: { label: string }) => (
    <th style={{ textAlign: 'left', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--fg2)', padding: '0 12px 12px', whiteSpace: 'nowrap' }}>{label}</th>
  )

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 18, color: 'var(--fg1)' }}>Mis pacientes</h2>
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <select value={sedeFilter} onChange={e => setSedeFilter(e.target.value)}
              style={{ appearance: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--teal-50)', color: 'var(--primary)', borderRadius: 8, padding: '6px 30px 6px 10px', fontSize: 12, fontWeight: 600, border: '1.5px solid var(--primary)', cursor: 'pointer', fontFamily: 'var(--font-body)', outline: 'none' }}>
              {SEDES.map(s => <option key={s} value={s}>{s === 'Todas' ? 'Todas las sedes' : `Sede: ${s}`}</option>)}
            </select>
            <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--primary)' }}>
              <WIcon name="chevron-down" size={13} />
            </span>
          </div>
        </div>
        <button style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'var(--surface)', border: '1.5px solid var(--border)', color: 'var(--primary)', borderRadius: 9999, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <DownloadIcon size={15} color="var(--primary)" /> Exportar lista
        </button>
      </div>

      <div style={{ padding: '0 24px 16px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 14px' }}>
          <WIcon name="search" size={16} color="var(--fg2)" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nombre…"
            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13.5, width: '100%', color: 'var(--fg1)' }} />
        </label>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          <col /><col style={{ width: 92 }} /><col style={{ width: 138 }} />
          <col style={{ width: 104 }} /><col style={{ width: 110 }} /><col style={{ width: 110 }} />
        </colgroup>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <Head label="Paciente" /><Head label="Sede" /><Head label="Días abstinencia" />
            <Head label="Estado" /><Head label="Última alerta" /><Head label="" />
          </tr>
        </thead>
        <tbody>
          {rows.map(p => {
            const danger = p.lastAlertTone === 'danger'
            return (
              <tr key={p.id} onClick={() => onOpen(p)}
                style={{ borderBottom: '1px solid var(--border)', background: danger ? 'var(--red-50)' : 'transparent', cursor: 'pointer', transition: 'background 0.14s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--teal-50)')}
                onMouseLeave={e => (e.currentTarget.style.background = danger ? 'var(--red-50)' : 'transparent')}
              >
                <td style={{ padding: '14px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: 'var(--teal-50)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13 }}>{p.initials}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14, color: 'var(--fg1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--fg2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.email}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '14px 12px' }}>
                  <span style={{ display: 'inline-block', background: 'var(--teal-50)', color: 'var(--primary)', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>{p.sede}</span>
                </td>
                <td style={{ padding: '14px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, color: 'var(--primary)', minWidth: 30 }}>{p.days}</span>
                    <ProgressBar value={p.days} max={120} color={danger ? 'var(--accent)' : 'var(--primary)'} />
                  </div>
                </td>
                <td style={{ padding: '14px 12px' }}><StatusBadge status={p.status} /></td>
                <td style={{ padding: '14px 12px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: danger ? 600 : 400, color: danger ? 'var(--danger)' : 'var(--fg2)' }}>
                    {danger && <WIcon name="circle-alert" size={14} color="var(--danger)" />}
                    {p.lastAlert}
                  </span>
                </td>
                <td style={{ padding: '14px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                    <span style={{ color: 'var(--primary)', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>Ver perfil</span>
                    <button onClick={e => e.stopPropagation()} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--fg2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <WIcon name="more-horizontal" size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px' }}>
        <span style={{ fontSize: 13, color: 'var(--fg2)' }}>Mostrando 1–{rows.length} de 24 pacientes</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {['chevron-left', 'chevron-right'].map((icon, i) => (
            <button key={icon} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 9999, border: '1px solid var(--border)', background: 'var(--surface)', color: i === 0 ? 'var(--disabled)' : 'var(--fg1)', cursor: 'pointer' }}>
              <WIcon name={icon} size={17} />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Panic Panel ─────────────────────────────────────── */
function PanicPanel({ onOpenPatient }: { onOpenPatient: (name: string) => void }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', borderTop: '3px solid var(--danger)', boxShadow: 'var(--shadow-soft)', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <WIcon name="triangle-alert" size={19} color="var(--danger)" />
          <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 18, color: 'var(--danger)' }}>Alertas de pánico</h2>
        </div>
        <span style={{ background: 'var(--red-50)', color: 'var(--danger)', borderRadius: 9999, padding: '3px 11px', fontSize: 12, fontWeight: 700 }}>3 hoy</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {TODAY_ALERTS.map((a, i) => (
          <div key={i} style={{ background: 'var(--red-50)', borderRadius: 12, borderLeft: '3px solid var(--danger)', padding: '12px 14px' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, color: 'var(--fg1)' }}>{a.name}</div>
            <div style={{ fontSize: 12, color: 'var(--fg2)', marginTop: 2 }}>{a.rel} · {a.time}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 8 }}>
              {a.resolved ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--sage-50)', color: 'var(--sage-500)', borderRadius: 9999, padding: '3px 10px', fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  <WIcon name="circle-check" size={13} /> Contención con IA
                </span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--surface)', color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: 9999, padding: '3px 10px', fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  <WIcon name="circle-alert" size={13} /> Sin resolver
                </span>
              )}
              <button onClick={() => onOpenPatient(a.name)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--primary)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0, whiteSpace: 'nowrap', flexShrink: 0 }}>
                Ver sesión <WIcon name="arrow-right" size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
        Ver historial completo <WIcon name="arrow-right" size={14} />
      </button>
    </div>
  )
}

/* ── Export Panel ────────────────────────────────────── */
function ExportPanel() {
  const [patientId, setPatientId] = useState('')
  const [from, setFrom] = useState('2026-05-01')
  const [to, setTo] = useState('2026-05-29')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)

  const inputStyle: React.CSSProperties = { height: 40, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', padding: '0 12px', fontSize: 13, color: 'var(--fg1)', width: '100%', boxSizing: 'border-box', outline: 'none' }

  const canExport = patientId !== '' && from !== '' && to !== ''

  function handleExport() {
    const patient = PATIENTS.find(p => p.id === patientId)
    if (!patient) return

    setLoading(true)
    setToast(null)

    // jsPDF runs synchronously; wrap in setTimeout to let the UI update first
    setTimeout(() => {
      try {
        generatePatientPDF(patient, from, to)
        setToast({ ok: true, msg: `Reporte de ${patient.name} descargado` })
      } catch {
        setToast({ ok: false, msg: 'Error al generar el PDF. Intenta nuevamente.' })
      } finally {
        setLoading(false)
        setTimeout(() => setToast(null), 3500)
      }
    }, 50)
  }

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)', padding: 20, position: 'relative' }}>
      <h2 style={{ margin: '0 0 4px', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16, color: 'var(--fg1)' }}>Generar reporte PDF</h2>
      <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--fg2)' }}>Exporta la evolución y alertas de un paciente.</p>

      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg2)', display: 'block', marginBottom: 6 }}>Paciente</label>
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <select
          value={patientId}
          onChange={e => setPatientId(e.target.value)}
          style={{ ...inputStyle, appearance: 'none', cursor: 'pointer', borderColor: !patientId ? 'var(--border)' : 'var(--primary)' }}
        >
          <option value="">Seleccionar paciente…</option>
          {PATIENTS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <span style={{ position: 'absolute', right: 12, top: 12, pointerEvents: 'none', color: 'var(--fg2)' }}><WIcon name="chevron-down" size={16} /></span>
      </div>

      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg2)', display: 'block', marginBottom: 6 }}>Rango de fechas</label>
      <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        {[{ label: 'Desde', val: from, set: setFrom }, { label: 'Hasta', val: to, set: setTo }].map(({ label, val, set }) => (
          <div key={label} style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--fg2)', marginBottom: 4 }}>{label}</div>
            <input type="date" value={val} onChange={e => set(e.target.value)} style={inputStyle} />
          </div>
        ))}
      </div>

      <button
        onClick={handleExport}
        disabled={!canExport || loading}
        style={{
          width: '100%', height: 46, borderRadius: 9999, border: 'none',
          background: canExport ? 'var(--primary)' : 'var(--border)',
          color: canExport ? '#fff' : 'var(--fg2)',
          fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15,
          cursor: canExport && !loading ? 'pointer' : 'not-allowed',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
          transition: 'background 0.2s',
        }}
      >
        {loading
          ? <><WIcon name="loader" size={18} color="currentColor" /> Generando…</>
          : <><DownloadIcon size={18} color={canExport ? '#fff' : 'var(--fg2)'} /> Exportar PDF</>
        }
      </button>
      <p style={{ margin: '10px 0 0', fontSize: 11, color: 'var(--fg2)', textAlign: 'center' }}>
        {canExport ? 'El reporte se generará en menos de 10 segundos.' : 'Selecciona un paciente y rango de fechas para continuar.'}
      </p>

      {toast && (
        <div style={{ position: 'absolute', left: 20, right: 20, bottom: 20, background: toast.ok ? '#1e2d2c' : 'var(--danger)', color: '#fff', borderRadius: 12, padding: '12px 16px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 9, boxShadow: 'var(--shadow-strong)', zIndex: 10 }}>
          <WIcon name={toast.ok ? 'circle-check' : 'circle-alert'} size={17} color={toast.ok ? 'var(--teal-400)' : '#fff'} />
          {toast.msg}
        </div>
      )}
    </div>
  )
}

/* ── Overview Page ───────────────────────────────────── */
interface OverviewPageProps {
  onNav: (id: string) => void
  reqCount: number
}

export function OverviewPage({ onNav, reqCount }: OverviewPageProps) {
  const [selected, setSelected] = useState<Patient | null>(null)

  const avgDays = Math.round(PATIENTS.reduce((s, p) => s + p.days, 0) / PATIENTS.length)

  const openByName = (name: string) => {
    const p = PATIENTS.find(x => x.name === name)
    if (p) setSelected(p)
  }

  return (
    <div style={{ padding: 32, maxWidth: 1440, minWidth: 1180, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <MetricCard icon="users" label="Pacientes activos" value="24" tone="teal" important
          sub={<><WIcon name="trending-up" size={14} color="var(--sage-500)" /><span style={{ color: 'var(--sage-500)', fontWeight: 600 }}>+2 este mes</span> · total en mi sede</>} />
        <MetricCard icon="inbox" label="Solicitudes pendientes" value={reqCount} tone="amber" important
          onClick={() => onNav('requests')}
          sub={<><WIcon name="clock" size={14} color="var(--accent)" /><span style={{ color: 'var(--accent)', fontWeight: 600 }}>{reqCount} esperando aprobación</span></>} />
        <MetricCard icon="triangle-alert" label="Alertas hoy" value="3" tone="red" important
          sub="Botones de pánico activados" />
        <MetricCard icon="trophy" label="Promedio abstinencia" value={avgDays} tone="gold" important
          sub="días promedio por paciente · acumulado 2026" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.85fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <PatientTable onOpen={setSelected} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <PanicPanel onOpenPatient={openByName} />
          <ExportPanel />
        </div>
      </div>

      {selected && <PatientDrawer patient={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
