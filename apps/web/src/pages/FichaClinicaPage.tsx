import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { WIcon } from '../components/WIcon'
import { SeccionCompaneroViaje } from '../components/SeccionCompaneroViaje'
import { EMOTION_EMOJI, followUp, relTime, shortSedeName } from '../utils/patientView'
import {
  api,
  CLINICAL_FIELDS,
  type ApiError,
  type ClinicalContent,
  type ClinicalField,
  type ClinicalNote,
  type IntakeView,
  type ClinicalRecordVersion,
} from '../services/api'

// HdU13. La ficha vive en su propia página y no en el panel lateral de «Mis pacientes»: son
// cinco relatos clínicos largos y en el ancho del panel no se podía leer lo que uno escribía.
//
// Se presenta como cinco tarjetas numeradas en vez de cinco `textarea` seguidos. La diferencia
// no es decorativa: un psicólogo que abre la ficha por primera vez tiene que entender QUÉ se
// espera en cada campo sin preguntarle a nadie, y una etiqueta sola no alcanza. Por eso cada
// tarjeta lleva para qué sirve, un ejemplo concreto y su estado.

type Campo = {
  id: ClinicalField
  label: string
  icono: string
  ayuda: string
  ejemplo: string
}

const CAMPOS: Campo[] = [
  {
    id: 'admissionReason',
    label: 'Motivo de ingreso',
    icono: 'clipboard-list',
    ayuda: 'Qué trae al paciente al programa y quién lo deriva.',
    ejemplo: 'Derivado por su pareja tras perder el sueldo en apuestas deportivas en línea.',
  },
  {
    id: 'gamblingHistory',
    label: 'Antecedentes de la conducta de juego',
    icono: 'chart-column',
    ayuda: 'Desde cuándo juega, en qué formatos y cómo fue escalando.',
    ejemplo: 'Juega hace 6 años. Empezó con quinielas entre amigos y pasó a casinos en línea en 2024.',
  },
  {
    id: 'triggers',
    label: 'Detonantes',
    icono: 'triangle-alert',
    ayuda: 'Situaciones que anteceden al impulso de jugar.',
    ejemplo: 'Días de pago, publicidad de casinos en transmisiones deportivas, discusiones en la casa.',
  },
  {
    id: 'healthAndSupport',
    label: 'Antecedentes de salud y red de apoyo',
    icono: 'heart-handshake',
    ayuda: 'Diagnósticos previos, tratamientos en curso y con quién cuenta fuera del grupo.',
    ejemplo: 'Sin patología previa diagnosticada. Vive con su pareja, que acompaña el proceso.',
  },
  {
    id: 'treatmentGoals',
    label: 'Objetivos del tratamiento',
    icono: 'target',
    ayuda: 'Qué se busca lograr en el programa y en qué plazo, incluida la participación en el grupo.',
    ejemplo: 'Sostener la abstinencia a 90 días, asistir al grupo cada semana y recuperar el manejo del sueldo.',
  },
]

const VACIA: ClinicalContent = Object.fromEntries(
  CLINICAL_FIELDS.map((f) => [f, '']),
) as ClinicalContent

const fechaLarga = (iso: string) =>
  new Date(iso).toLocaleString('es-CL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

export function FichaClinicaPage() {
  const { patientId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [form, setForm] = useState<ClinicalContent>(VACIA)
  const [pendientes, setPendientes] = useState<ClinicalField[]>([])
  const [guardado, setGuardado] = useState<string | null>(null)
  const [historialAbierto, setHistorialAbierto] = useState(false)
  // Una ficha escrita se lee mucho más veces de las que se corrige: el psicólogo la abre antes
  // de una sesión para recordar el caso. En modo lectura se ve el texto y ya; los cinco
  // `textarea` aparecen solo cuando se entra a editar.
  const [editando, setEditando] = useState(false)
  const [nota, setNota] = useState('')
  const [escribiendoNota, setEscribiendoNota] = useState(false)

  const { data: patients = [] } = useQuery({ queryKey: ['patients'], queryFn: api.getPatients })
  const paciente = patients.find((p) => p.id === patientId)
  // La regla de seguimiento vive en utils/patientView y no se duplica (ver CLAUDE.md).
  const fila = paciente ? followUp(paciente) : null

  const { data: metrics } = useQuery({
    queryKey: ['patient-metrics', patientId],
    queryFn: () => api.getPatientMetrics(patientId),
    enabled: Boolean(patientId),
    retry: false,
  })

  const { data: view, isLoading, isError, error } = useQuery({
    queryKey: ['clinical-record', patientId],
    queryFn: () => api.getClinicalRecord(patientId),
    enabled: Boolean(patientId),
    retry: false,
  })

  // El formulario arranca con lo guardado, y solo se sincroniza cuando llega la ficha del
  // servidor: si se recalculara en cada render, un refetch pisaría lo que se está escribiendo.
  useEffect(() => {
    if (!view) return
    setForm(view.content)
    // Una ficha que no existe no tiene nada que leer: se abre directamente en edición para no
    // obligar a un clic que no decide nada.
    if (!view.exists) setEditando(true)
  }, [view])

  const completados = CLINICAL_FIELDS.filter((f) => form[f].trim()).length

  const sinGuardar = useMemo(
    () => Boolean(view) && CLINICAL_FIELDS.some((f) => form[f] !== view!.content[f]),
    [form, view],
  )

  useEffect(() => {
    if (!sinGuardar) return
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [sinGuardar])

  const guardar = useMutation({
    mutationFn: () => api.saveClinicalRecord(patientId, form),
    onSuccess: (record) => {
      queryClient.invalidateQueries({ queryKey: ['clinical-record', patientId] })
      queryClient.invalidateQueries({ queryKey: ['clinical-record-history', patientId] })
      queryClient.invalidateQueries({ queryKey: ['clinical-record-status'] })
      setPendientes([])
      setGuardado(record.updatedAt)
      setEditando(false)
    },
    onError: (err: ApiError) => {
      // El backend valida igual que el cliente (CA3). Si rechaza, se traduce su respuesta a los
      // campos que hay que resaltar en vez de mostrar un error genérico.
      const mensajes = err.body?.message
      if (Array.isArray(mensajes)) {
        const faltan = CAMPOS.filter((c) =>
          mensajes.some((m: string) => m.toLowerCase().includes(c.label.toLowerCase())),
        ).map((c) => c.id)
        if (faltan.length) setPendientes(faltan)
      }
    },
  })

  const { data: historial = [], isLoading: cargandoHistorial } = useQuery<ClinicalRecordVersion[]>({
    queryKey: ['clinical-record-history', patientId],
    queryFn: () => api.getClinicalRecordHistory(patientId),
    enabled: historialAbierto && Boolean(view?.exists),
    retry: false,
  })

  const { data: intake } = useQuery<IntakeView>({
    queryKey: ['patient-intake', patientId],
    queryFn: () => api.getPatientIntake(patientId),
    enabled: Boolean(patientId),
    retry: false,
  })

  const { data: notas = [] } = useQuery<ClinicalNote[]>({
    queryKey: ['clinical-notes', patientId],
    queryFn: () => api.getClinicalNotes(patientId),
    enabled: Boolean(patientId),
    retry: false,
  })

  const agregarNota = useMutation({
    mutationFn: () => api.addClinicalNote(patientId, nota.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinical-notes', patientId] })
      setNota('')
      setEscribiendoNota(false)
    },
  })

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setGuardado(null)

    // CA3: se valida antes de enviar y NO se toca `form`, así lo ya escrito queda en pantalla.
    const faltan = CLINICAL_FIELDS.filter((f) => !form[f].trim())
    setPendientes(faltan)
    if (faltan.length) {
      document.getElementById(`ficha-${faltan[0]}`)?.focus()
      return
    }
    guardar.mutate()
  }

  const cancelar = () => {
    if (view) setForm(view.content)
    setPendientes([])
    setEditando(false)
  }

  const escribir = (campo: ClinicalField, valor: string) => {
    setForm((prev) => ({ ...prev, [campo]: valor }))
    setPendientes((prev) => prev.filter((f) => f !== campo))
    setGuardado(null)
  }

  const nombre = paciente ? `${paciente.firstName} ${paciente.lastName}` : 'este paciente'

  if (isError) {
    const status = (error as ApiError)?.status
    return (
      <div style={{ padding: 32, maxWidth: 560 }}>
        <Volver onClick={() => navigate('/pacientes')} />
        <div style={{ ...tarjeta, marginTop: 18 }}>
          <WIcon name="shield" size={26} color="var(--fg2)" />
          <h2 style={{ ...titulo, fontSize: 20, margin: '12px 0 8px' }}>
            {status === 403 ? 'No tienes acceso a esta ficha' : 'No se pudo abrir la ficha'}
          </h2>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--fg2)', lineHeight: 1.6 }}>
            {status === 403
              ? 'La ficha clínica solo la ve el equipo que atiende al paciente. Si crees que debería estar asignado a ti, habla con la coordinación.'
              : 'Revisa tu conexión y vuelve a intentarlo.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '22px 26px 48px', maxWidth: 1180 }}>
      <Volver onClick={() => navigate('/pacientes')} />

      <header style={{ margin: '14px 0 18px' }}>
        <h2 style={{ ...titulo, fontSize: 24, margin: '0 0 4px' }}>Ficha clínica</h2>
        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--fg2)' }}>
          {nombre}
          {view?.record && ` · Última modificación: ${fechaLarga(view.record.updatedAt)} por ${view.record.updatedByName}`}
        </p>
        <p style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--fg2)', lineHeight: 1.55 }}>
          Tres cosas distintas: lo que <strong>declaró el paciente</strong> al ingresar, que no
          se edita; <strong>tu lectura del caso</strong>, que sí; y las{' '}
          <strong>anotaciones</strong> del seguimiento, que se acumulan.
        </p>
      </header>

      {isLoading ? (
        <p style={{ fontSize: 14, color: 'var(--fg2)' }}>Cargando ficha…</p>
      ) : (
        <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 520px', minWidth: 300 }}>
          {editando ? (
            <Progreso completados={completados} nueva={Boolean(view && !view.exists)} />
          ) : (
            <BarraLectura
              guardado={guardado}
              onEditar={() => { setGuardado(null); setEditando(true) }}
            />
          )}

          {/* Se muestra también mientras se edita: una ficha que no existe abre directo en
              edición, y es justo ahí —escribiendo la entrevista de ingreso— cuando el psicólogo
              necesita tener a la vista lo que el paciente declaró. Lo que no aparece en edición
              es el aviso de «no declaró nada»: sin contenido que consultar, solo estorba sobre
              el formulario. */}
          {intake && (!editando || intake.answered) && <Ingreso intake={intake} />}

          {/* Encabezado de la segunda capa. Sin él, los cinco campos quedaban sueltos debajo de
              lo declarado por el paciente y se leían como una continuación de lo mismo: la
              confusión entre «lo que dijo el paciente» y «lo que escribió el psicólogo» es
              exactamente la que hay que evitar en un registro clínico. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, margin: '26px 0 2px' }}>
            <WIcon name="clipboard-list" size={18} color="var(--primary-text)" />
            <h3 style={{ ...titulo, fontSize: 16 }}>Tu lectura del caso</h3>
            <span style={{ fontSize: 13, color: 'var(--fg2)' }}>
              la escribes tú, no el paciente
            </span>
          </div>

          {!editando ? (
            <div style={{ marginTop: 16 }}>
              {CAMPOS.map((campo, i) => (
                <TarjetaLectura key={campo.id} campo={campo} numero={i + 1} valor={form[campo.id]} />
              ))}
            </div>
          ) : (
          <form onSubmit={onSubmit} noValidate style={{ marginTop: 16 }}>
            {CAMPOS.map((campo, i) => (
              <TarjetaCampo
                key={campo.id}
                campo={campo}
                numero={i + 1}
                valor={form[campo.id]}
                falta={pendientes.includes(campo.id)}
                onChange={(v) => escribir(campo.id, v)}
              />
            ))}

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                flexWrap: 'wrap',
                marginTop: 22,
              }}
            >
              <button
                type="submit"
                disabled={guardar.isPending}
                style={{
                  border: 'none',
                  background: 'var(--primary)',
                  color: 'var(--fg-on-primary)',
                  borderRadius: 9999,
                  height: 44,
                  padding: '0 26px',
                  fontWeight: 700,
                  fontSize: 14.5,
                  cursor: guardar.isPending ? 'default' : 'pointer',
                  opacity: guardar.isPending ? 0.7 : 1,
                }}
              >
                {guardar.isPending ? 'Guardando…' : 'Guardar ficha'}
              </button>

              {/* CA2: la confirmación. Se queda en pantalla en vez de desvanecerse: si
                  desaparece, el psicólogo no sabe si alcanzó a guardar. */}
              {view?.exists && (
                <button
                  type="button"
                  onClick={cancelar}
                  style={{
                    border: '1px solid var(--border)', background: 'var(--surface)',
                    color: 'var(--fg2)', borderRadius: 9999, height: 44, padding: '0 20px',
                    fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
              )}

              <div aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {pendientes.length > 0 && (
                  <span style={{ fontSize: 13.5, color: 'var(--danger-text)' }}>
                    {pendientes.length === 1
                      ? 'Falta 1 campo por completar'
                      : `Faltan ${pendientes.length} campos por completar`}
                  </span>
                )}
                {guardar.isError && pendientes.length === 0 && (
                  <span style={{ fontSize: 13.5, color: 'var(--danger-text)' }}>
                    No se pudo guardar. Lo que escribiste sigue acá: vuelve a intentarlo.
                  </span>
                )}
                {sinGuardar && !guardar.isPending && pendientes.length === 0 && (
                  <span style={{ fontSize: 13.5, color: 'var(--fg2)' }}>Cambios sin guardar</span>
                )}
              </div>
            </div>
          </form>
          )}

          {/* Las anotaciones no están en los CA de la HdU13: las pidió el PO porque la ficha
              describe el caso y se corrige, mientras que el día a día del grupo necesita una
              cronología que se acumule. Se muestran siempre, incluso sin ficha: se anota desde
              la primera sesión. */}
          <section style={{ marginTop: 30 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
              <WIcon name="message-circle" size={18} color="var(--primary-text)" />
              <h3 style={{ ...titulo, fontSize: 16 }}>Anotaciones</h3>
              <span style={{ fontSize: 13, color: 'var(--fg2)' }}>
                {notas.length === 0
                  ? 'del seguimiento'
                  : `${notas.length} ${notas.length === 1 ? 'anotación' : 'anotaciones'}`}
              </span>
              {!escribiendoNota && (
                <button
                  type="button"
                  onClick={() => setEscribiendoNota(true)}
                  style={{
                    marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6,
                    border: '1px solid var(--border)', background: 'var(--surface)',
                    color: 'var(--primary-text)', borderRadius: 9999, height: 36,
                    padding: '0 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  }}
                >
                  <WIcon name="notebook-pen" size={15} color="var(--primary-text)" />
                  Agregar anotación
                </button>
              )}
            </div>

            {escribiendoNota && (
              <div style={{ ...tarjeta, padding: '16px 18px', marginBottom: 12 }}>
                <label
                  htmlFor="ficha-nota"
                  style={{ display: 'block', fontSize: 13, color: 'var(--fg2)', marginBottom: 8 }}
                >
                  Qué pasó en esta sesión o entre sesiones. Queda con tu nombre y la fecha, y no
                  se puede editar después.
                </label>
                <textarea
                  id="ficha-nota"
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  rows={3}
                  autoFocus
                  placeholder="Llegó al grupo por primera vez. Habló de la deuda frente a los demás."
                  style={{
                    width: '100%', boxSizing: 'border-box', padding: '11px 13px',
                    borderRadius: 10, border: '1px solid var(--border)',
                    background: 'var(--surface)', color: 'var(--fg1)',
                    fontFamily: 'inherit', fontSize: 14, lineHeight: 1.6, resize: 'vertical',
                  }}
                />
                <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => agregarNota.mutate()}
                    disabled={!nota.trim() || agregarNota.isPending}
                    style={{
                      border: 'none', background: 'var(--primary)', color: 'var(--fg-on-primary)',
                      borderRadius: 9999, height: 38, padding: '0 20px', fontWeight: 700,
                      fontSize: 13.5,
                      cursor: !nota.trim() || agregarNota.isPending ? 'default' : 'pointer',
                      opacity: !nota.trim() || agregarNota.isPending ? 0.6 : 1,
                    }}
                  >
                    {agregarNota.isPending ? 'Guardando…' : 'Guardar anotación'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setNota(''); setEscribiendoNota(false) }}
                    style={{
                      border: '1px solid var(--border)', background: 'var(--surface)',
                      color: 'var(--fg2)', borderRadius: 9999, height: 38, padding: '0 18px',
                      fontWeight: 700, fontSize: 13, cursor: 'pointer',
                    }}
                  >
                    Cancelar
                  </button>
                  {agregarNota.isError && (
                    <span style={{ fontSize: 13, color: 'var(--danger-text)' }}>
                      No se pudo guardar. Lo que escribiste sigue acá.
                    </span>
                  )}
                </div>
              </div>
            )}

            {notas.length === 0 && !escribiendoNota ? (
              <p style={{ margin: 0, fontSize: 13.5, color: 'var(--fg2)', lineHeight: 1.6 }}>
                Todavía no hay anotaciones. Sirven para registrar lo que pasa sesión a sesión sin
                reescribir la ficha.
              </p>
            ) : (
              <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {notas.map((n) => (
                  <li key={n.id} style={{ ...tarjeta, padding: '14px 18px', marginBottom: 10 }}>
                    <div style={{ fontSize: 12.5, color: 'var(--fg2)', marginBottom: 6 }}>
                      {fechaLarga(n.createdAt)} · {n.authorName}
                    </div>
                    <p style={{ margin: 0, fontSize: 14, color: 'var(--fg1)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {n.content}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* CA4 */}
          {view?.exists && (
            <section style={{ marginTop: 32 }}>
              <button
                type="button"
                onClick={() => setHistorialAbierto((v) => !v)}
                aria-expanded={historialAbierto}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  borderTop: '1px solid var(--border)',
                  padding: '18px 0 14px',
                  cursor: 'pointer',
                  ...titulo,
                  fontSize: 16,
                }}
              >
                <WIcon
                  name={historialAbierto ? 'chevron-down' : 'chevron-right'}
                  size={18}
                  color="var(--fg2)"
                />
                Historial de cambios
                <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--fg2)' }}>
                  para auditoría clínica
                </span>
              </button>

              {historialAbierto &&
                (cargandoHistorial ? (
                  <p style={{ fontSize: 13.5, color: 'var(--fg2)' }}>Cargando historial…</p>
                ) : (
                  <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {historial.map((v) => (
                      <li key={v.id} style={{ ...tarjeta, padding: '16px 18px', marginBottom: 12 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: 10,
                            flexWrap: 'wrap',
                            marginBottom: 12,
                          }}
                        >
                          <span style={{ ...titulo, fontSize: 14 }}>Versión {v.versionNumber}</span>
                          <span style={{ fontSize: 13, color: 'var(--fg2)' }}>
                            {fechaLarga(v.changedAt)} · {v.changedByName}
                          </span>
                        </div>

                        {v.changedFields.map((c) => (
                          <div key={c.field} style={{ marginBottom: 12 }}>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: 'var(--fg2)',
                                marginBottom: 5,
                              }}
                            >
                              {CAMPOS.find((x) => x.id === c.field)?.label ?? c.field}
                            </div>
                            {c.before ? (
                              <p
                                style={{
                                  margin: '0 0 4px',
                                  fontSize: 13,
                                  color: 'var(--fg2)',
                                  textDecoration: 'line-through',
                                  lineHeight: 1.55,
                                }}
                              >
                                {c.before}
                              </p>
                            ) : (
                              <p style={{ margin: '0 0 4px', fontSize: 12.5, color: 'var(--fg2)' }}>
                                (estaba vacío)
                              </p>
                            )}
                            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--fg1)', lineHeight: 1.55 }}>
                              {c.after}
                            </p>
                          </div>
                        ))}
                      </li>
                    ))}
                  </ol>
                ))}
            </section>
          )}
          </div>

          {/* La ficha se lee sobre todo antes de una sesión, y ahí lo primero que uno quiere
              saber es cómo viene el paciente. Todo esto ya existía repartido en otras pantallas;
              lo que faltaba era tenerlo al lado del texto que se está leyendo. */}
          <aside style={{ flex: '0 1 280px', minWidth: 240, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <section style={{ ...tarjeta, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--teal-50)', color: 'var(--primary-text)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14,
                }}>{fila?.initials ?? '··'}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ ...titulo, fontSize: 14.5 }}>{nombre}</div>
                  {sedeLegible(paciente?.sedeId) && (
                    <div style={{ fontSize: 12, color: 'var(--fg2)' }}>
                      Sede {sedeLegible(paciente?.sedeId)}
                    </div>
                  )}
                </div>
              </div>

              <Dato
                label="Racha actual"
                valor={paciente ? `${paciente.daysStreak} días` : '-'}
              />
              <Dato
                label="Último check-in"
                valor={
                  !paciente?.lastCheckIn
                    ? 'Sin check-ins'
                    : `${EMOTION_EMOJI[paciente.lastCheckIn.emotion] ?? ''} ${relTime(paciente.lastCheckIn.date)}`
                }
              />
              <Dato
                label="Adherencia 28 días"
                valor={fila ? `${fila.adherencia}%` : '-'}
              />
              <Dato
                label="Ánimo reciente"
                valor={fila?.moodReciente === null || fila === null ? '-' : `${fila.moodReciente}/5`}
              />
              <Dato
                label="Alertas de pánico"
                valor={metrics ? `${metrics.panicCount}` : '-'}
                ultimo
              />

              {fila && fila.flags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                  {fila.flags.map((f) => (
                    <span
                      key={f.label}
                      style={{
                        display: 'inline-block', borderRadius: 9999, padding: '3px 10px',
                        fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap',
                        background: f.tone === 'danger' ? 'var(--red-50)' : 'var(--surface-alt)',
                        color: f.tone === 'danger' ? 'var(--danger-text)' : 'var(--primary-text)',
                      }}
                    >
                      {f.label}
                    </span>
                  ))}
                </div>
              )}

              {/* `?paciente=` lo abre «Mis pacientes» en el panel de Seguimiento: la ruta ya
                  existía para llegar desde Resumen. */}
              <button
                type="button"
                onClick={() => navigate(`/pacientes?paciente=${patientId}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7, width: '100%',
                  justifyContent: 'center', marginTop: 14,
                  border: '1px solid var(--border)', background: 'var(--surface)',
                  color: 'var(--primary-text)', borderRadius: 9999, height: 38,
                  fontWeight: 700, fontSize: 13, cursor: 'pointer',
                }}
              >
                <WIcon name="activity" size={15} color="var(--primary-text)" />
                Ver seguimiento
              </button>
            </section>

            {/* Lo que el psicólogo tiene que tener presente al escribir la ficha, y que no se
                ve en ninguna otra parte del panel. */}
            <section style={{ ...tarjeta, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <WIcon name="shield" size={15} color="var(--fg2)" />
                <h3 style={{ ...titulo, fontSize: 13.5 }}>Quién ve esto</h3>
              </div>
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--fg2)', lineHeight: 1.55 }}>
                Solo tú y la coordinación de la sede. El paciente no accede a su ficha. De todos
                los campos, únicamente los <strong>detonantes</strong> llegan al asistente, y sin
                nombres, RUT ni teléfonos: se tachan antes de salir.
              </p>
            </section>

            <SeccionCompaneroViaje patientId={patientId} />
          </aside>
        </div>
      )}
    </div>
  )
}

// `users.sedeId` guarda el nombre de la sede o su UUID según de dónde venga la cuenta (ver
// CLAUDE.md). Mostrarlo crudo dejaría «Sede c7500b05-dbb3-...» en pantalla, así que cuando es
// un UUID no se muestra nada: media línea de más es mejor que un identificador a la vista.
const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function sedeLegible(sedeId: string | null | undefined): string | null {
  if (!sedeId || ES_UUID.test(sedeId)) return null
  return shortSedeName(sedeId)
}

function Dato({ label, valor, ultimo }: { label: string; valor: string; ultimo?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
        padding: '8px 0',
        borderBottom: ultimo ? 'none' : '1px solid var(--border)',
      }}
    >
      <span style={{ fontSize: 12.5, color: 'var(--fg2)', flex: 1 }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, color: 'var(--fg1)' }}>
        {valor}
      </span>
    </div>
  )
}

// Modo lectura: lo que el psicólogo ve al abrir una ficha ya escrita. No hay barra de
// progreso porque no hay nada en progreso, y la confirmación del último guardado se mantiene
// acá para que siga visible después de volver de editar (CA2).
// Lo que el paciente declaró al registrarse. Va **antes** de la ficha y marcado como suyo: el
// psicólogo tiene que poder distinguir de un vistazo lo que dijo el paciente de lo que escribió
// él. Es de solo lectura a propósito; si se pudiera corregir, dejaría de ser lo que el paciente
// declaró.
function Ingreso({ intake }: { intake: IntakeView }) {
  const [abierto, setAbierto] = useState(true)

  if (!intake.answered || !intake.answers) {
    return (
      <div style={{ ...tarjeta, padding: '14px 18px', marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <WIcon name="inbox" size={16} color="var(--fg2)" />
          <span style={{ fontSize: 13, color: 'var(--fg2)', lineHeight: 1.5 }}>
            Este paciente se registró antes de que el formulario de ingreso incluyera preguntas
            sobre su juego, así que no hay nada declarado por él.
          </span>
        </div>
      </div>
    )
  }

  const a = intake.answers
  const listaConOtro = (items: string[], otro: string | null) =>
    otro ? [...items, otro] : items

  const bloques: { label: string; valores: string[] }[] = [
    { label: 'Qué lo trae a AJUTER', valores: listaConOtro(a.motive ? [a.motive] : [], a.motiveOther) },
    { label: 'A qué juega o apuesta', valores: listaConOtro(a.gamblingTypes, a.gamblingTypesOther) },
    { label: 'Hace cuánto', valores: a.duration ? [a.duration] : [] },
    { label: 'Cuándo le dan más ganas', valores: listaConOtro(a.triggers, a.triggersOther) },
  ].filter((b) => b.valores.length > 0)

  return (
    <section style={{ ...tarjeta, padding: '16px 18px', marginTop: 14 }}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        style={{
          display: 'flex', alignItems: 'center', gap: 9, width: '100%',
          background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
        }}
      >
        <WIcon name={abierto ? 'chevron-down' : 'chevron-right'} size={17} color="var(--fg2)" />
        <WIcon name="user-round" size={17} color="var(--primary-text)" />
        <h3 style={{ ...titulo, fontSize: 15 }}>Declarado por el paciente al ingresar</h3>
        {intake.submittedAt && (
          <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--fg2)' }}>
            {new Date(intake.submittedAt).toLocaleDateString('es-CL', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
          </span>
        )}
      </button>

      {abierto && (
        <div style={{ marginTop: 14 }}>
          {bloques.map((b) => (
            <div key={b.label} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg2)', marginBottom: 6 }}>
                {b.label}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {b.valores.map((v) => (
                  <span
                    key={v}
                    style={{
                      display: 'inline-block', background: 'var(--surface-alt)',
                      color: 'var(--fg1)', borderRadius: 9999, padding: '4px 12px',
                      fontSize: 12.5, lineHeight: 1.4,
                    }}
                  >
                    {v}
                  </span>
                ))}
              </div>
            </div>
          ))}
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--fg2)', lineHeight: 1.5 }}>
            Son sus palabras al registrarse, no una evaluación clínica. No se edita desde acá:
            tu lectura del caso va en los campos de abajo.
          </p>
        </div>
      )}
    </section>
  )
}

function BarraLectura({ guardado, onEditar }: { guardado: string | null; onEditar: () => void }) {
  return (
    <div
      style={{
        ...tarjeta,
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      {guardado ? (
        <>
          <WIcon name="circle-check" size={18} color="var(--secondary-text)" />
          <span style={{ fontSize: 13.5, color: 'var(--secondary-text)', fontWeight: 600 }}>
            Ficha guardada · {fechaLarga(guardado)}
          </span>
        </>
      ) : (
        <>
          <WIcon name="circle-check" size={18} color="var(--secondary-text)" />
          <span style={{ ...titulo, fontSize: 15 }}>Ficha completa</span>
        </>
      )}

      <button
        type="button"
        onClick={onEditar}
        style={{
          marginLeft: 'auto',
          border: 'none',
          background: 'var(--primary)',
          color: 'var(--fg-on-primary)',
          borderRadius: 9999,
          height: 40,
          padding: '0 22px',
          fontWeight: 700,
          fontSize: 14,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
        }}
      >
        <WIcon name="notebook-pen" size={16} color="var(--fg-on-primary)" />
        Editar ficha
      </button>
    </div>
  )
}

function TarjetaLectura({ campo, numero, valor }: { campo: Campo; numero: number; valor: string }) {
  return (
    <div style={{ ...tarjeta, padding: '16px 18px', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--surface-alt)',
            color: 'var(--primary-text)',
            fontFamily: 'var(--font-heading)',
            fontWeight: 700,
            fontSize: 12,
          }}
        >
          {numero}
        </span>
        <WIcon name={campo.icono} size={17} color="var(--primary-text)" />
        <h3 style={{ ...titulo, fontSize: 15 }}>{campo.label}</h3>
      </div>

      {/* `pre-wrap`: el psicólogo escribe con saltos de línea y una ficha clínica que los
          colapsa convierte cinco puntos en un párrafo corrido. */}
      <p
        style={{
          margin: '0 0 0 34px',
          fontSize: 14,
          color: 'var(--fg1)',
          lineHeight: 1.65,
          whiteSpace: 'pre-wrap',
        }}
      >
        {valor}
      </p>
    </div>
  )
}

function Progreso({ completados, nueva }: { completados: number; nueva: boolean }) {
  const total = CLINICAL_FIELDS.length
  const pct = Math.round((completados / total) * 100)
  const listo = completados === total

  return (
    <div style={{ ...tarjeta, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <WIcon
          name={listo ? 'circle-check' : 'notebook-pen'}
          size={18}
          color={listo ? 'var(--secondary-text)' : 'var(--primary-text)'}
        />
        <span style={{ ...titulo, fontSize: 15 }}>
          {completados} de {total} completados
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--fg2)' }}>
          {nueva ? 'Ficha nueva' : listo ? 'Ficha completa' : 'En progreso'}
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={completados}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`${completados} de ${total} campos completados`}
        style={{ height: 8, borderRadius: 999, background: 'var(--surface-alt)', overflow: 'hidden' }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: 999,
            // Verde de relleno, no de texto: acá es una barra, no una etiqueta.
            background: listo ? 'var(--secondary)' : 'var(--primary)',
            transition: 'width 0.3s var(--ease-calm, ease)',
          }}
        />
      </div>

      {nueva && (
        <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--fg2)', lineHeight: 1.55 }}>
          Este paciente todavía no tiene ficha. Completa los cinco campos para crearla: quedan
          guardados con tu nombre y la fecha, y cada cambio posterior queda registrado.
        </p>
      )}
    </div>
  )
}

function TarjetaCampo({
  campo,
  numero,
  valor,
  falta,
  onChange,
}: {
  campo: Campo
  numero: number
  valor: string
  falta: boolean
  onChange: (v: string) => void
}) {
  const completo = Boolean(valor.trim())
  const esDetonantes = campo.id === 'triggers'

  return (
    <div
      style={{
        ...tarjeta,
        padding: '16px 18px',
        marginBottom: 14,
        // El borde marca el estado del campo. Rojo solo el borde, nunca el fondo: el relleno
        // `--danger` está reservado para el pánico.
        borderColor: falta ? 'var(--danger)' : 'var(--border)',
        boxShadow: falta ? '0 0 0 3px color-mix(in srgb, var(--danger) 8%, transparent)' : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: completo ? 'var(--secondary)' : 'var(--surface-alt)',
            color: completo ? 'var(--fg-on-secondary, #fff)' : 'var(--primary-text)',
            fontFamily: 'var(--font-heading)',
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          {completo ? <WIcon name="check" size={15} color="var(--fg-on-secondary, #fff)" /> : numero}
        </div>

        <WIcon name={campo.icono} size={17} color="var(--primary-text)" />

        <label htmlFor={`ficha-${campo.id}`} style={{ ...titulo, fontSize: 15, cursor: 'pointer' }}>
          {campo.label}
        </label>

        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--fg2)' }}>
          {completo ? 'Completado' : 'Pendiente'}
        </span>
      </div>

      <p style={{ margin: '0 0 4px 38px', fontSize: 13, color: 'var(--fg2)', lineHeight: 1.5 }}>
        {campo.ayuda}
      </p>

      {/* El único campo de la ficha que sale hacia el asistente. Decirlo acá, y no en la
          documentación, es lo que hace que el psicólogo escriba pensando en para qué sirve. */}
      {esDetonantes && (
        <p
          style={{
            display: 'flex',
            gap: 7,
            alignItems: 'flex-start',
            margin: '0 0 8px 38px',
            padding: '9px 11px',
            borderRadius: 10,
            background: 'var(--surface-alt)',
            fontSize: 12.5,
            color: 'var(--fg2)',
            lineHeight: 1.5,
          }}
        >
          <WIcon name="sparkles" size={15} color="var(--primary-text)" />
          <span>
            Lo que escribas acá es lo único de la ficha que el asistente usa para acompañar al
            paciente. Los nombres conocidos, los RUT y los teléfonos se tachan antes de salir,
            pero igual conviene escribir la situación y no quién la protagoniza: a un tercero
            que no esté registrado acá nadie lo reconoce.
          </span>
        </p>
      )}

      <textarea
        id={`ficha-${campo.id}`}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder={campo.ejemplo}
        aria-invalid={falta}
        aria-describedby={falta ? `ficha-${campo.id}-error` : undefined}
        style={{
          width: '100%',
          marginLeft: 38,
          maxWidth: 'calc(100% - 38px)',
          boxSizing: 'border-box',
          padding: '11px 13px',
          borderRadius: 10,
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          color: 'var(--fg1)',
          fontFamily: 'inherit',
          fontSize: 14,
          lineHeight: 1.6,
          resize: 'vertical',
        }}
      />

      {falta && (
        <p
          id={`ficha-${campo.id}-error`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            margin: '6px 0 0 38px',
            fontSize: 12.5,
            color: 'var(--danger-text)',
          }}
        >
          <WIcon name="circle-alert" size={14} color="var(--danger-text)" />
          Falta completar este campo para poder guardar
        </p>
      )}
    </div>
  )
}

function Volver({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        fontSize: 13.5,
        color: 'var(--primary-text)',
        fontWeight: 600,
      }}
    >
      <WIcon name="chevron-left" size={17} color="var(--primary-text)" />
      Mis pacientes
    </button>
  )
}

const tarjeta: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 16,
  padding: '18px 20px',
  boxShadow: 'var(--shadow-soft)',
}

const titulo: React.CSSProperties = {
  fontFamily: 'var(--font-heading)',
  fontWeight: 700,
  color: 'var(--fg1)',
  margin: 0,
}
