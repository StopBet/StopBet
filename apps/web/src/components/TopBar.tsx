interface TopBarProps {
  title: string
}

export function TopBar({ title }: TopBarProps) {
  return (
    <header style={{
      height: 64, flexShrink: 0, background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      boxShadow: '0 1px 3px color-mix(in srgb, var(--primary-hover) 4%, transparent)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 32px', position: 'sticky', top: 0, zIndex: 5,
    }}>
      {/* El título de la sección es el h1 de la página. La campana ("3" fijo) y el
          avatar ("MG" fijo) mostraban datos inventados en todas las pantallas; el usuario
          ya aparece en la barra lateral. La campana vuelve cuando haya notificaciones reales. */}
      <h1 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 18, color: 'var(--fg1)' }}>
        {title}
      </h1>
    </header>
  )
}
