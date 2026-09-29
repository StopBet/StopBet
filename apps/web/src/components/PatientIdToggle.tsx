// Cómo identifica el familiar a su paciente (HDU 22): por RUT o por correo. Lo usan el registro
// y el formulario del portal para volver a declararlo.
export type PatientIdBy = 'rut' | 'email'

export function PatientIdToggle({ value, onChange }: { value: PatientIdBy; onChange: (v: PatientIdBy) => void }) {
  const options: { id: PatientIdBy; label: string }[] = [
    { id: 'rut', label: 'Por RUT' },
    { id: 'email', label: 'Por correo' },
  ]
  return (
    <div
      role="radiogroup"
      aria-label="Cómo identificar al paciente"
      style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 9999, background: 'var(--surface-alt)', marginBottom: 14 }}
    >
      {options.map(o => {
        const selected = o.id === value
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.id)}
            style={{
              flex: 1, height: 38, borderRadius: 9999, cursor: 'pointer',
              border: 'none', fontFamily: 'var(--sb-font-body)', fontSize: 13.5, fontWeight: 600,
              background: selected ? 'var(--surface)' : 'transparent',
              color: selected ? 'var(--primary-text)' : 'var(--fg2)',
              boxShadow: selected ? 'var(--shadow-soft)' : 'none',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
