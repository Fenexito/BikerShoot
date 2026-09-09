import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export const settingsInputClass = 'w-full rounded-2xl border border-border bg-input px-4 py-2.5 text-sm outline-none focus:border-accent'

/** Piezas de UI de "Configuración" extraídas de `StudioSettings.tsx` (el
 * primer portal donde se construyeron) para que el biker las reutilice con
 * la misma consistencia visual pedida — misma tarjeta con secciones, mismo
 * patrón de fila editable, mismo switch de notificaciones — sin que ambas
 * páginas mantengan cada una su propia copia. */
export function SettingsSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-6 sm:p-8">
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

function InlineSaveButton({ onClick, loading, children }: { onClick: () => void; loading?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="mt-3 flex h-10 items-center justify-center gap-2 self-start rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
    >
      {loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  )
}

/** Mismo patrón observado en vivo en mobbin.com/settings: "Editar" no
 * convierte el valor en un input en el mismo sitio — expande un bloque
 * debajo con una descripción corta, el campo editable y un botón "Guardar";
 * "Editar" se sustituye por "Cancelar" en su mismo lugar mientras tanto. */
export function SettingsEditableRow({
  label,
  value,
  description,
  placeholder,
  onSave,
  type = 'text',
  multiline = false,
}: {
  label: string
  value: string
  description?: string
  placeholder?: string
  onSave: (next: string) => Promise<void>
  type?: string
  multiline?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(draft)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border-b border-border py-4 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{label}</p>
        <button onClick={() => setEditing((e) => !e)} className="shrink-0 text-xs font-semibold text-foreground hover:underline">
          {editing ? 'Cancelar' : 'Editar'}
        </button>
      </div>
      {editing ? (
        <div className="mt-3 flex flex-col">
          {description && <p className="mb-2 text-xs text-muted-foreground">{description}</p>}
          {multiline ? (
            <textarea autoFocus rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} className={settingsInputClass} />
          ) : (
            <input autoFocus type={type} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} className={settingsInputClass} />
          )}
          <InlineSaveButton onClick={handleSave} loading={saving}>
            Guardar
          </InlineSaveButton>
        </div>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">{value || placeholder || '—'}</p>
      )}
    </div>
  )
}

export function SettingsNotificationToggle({ enabled, onChange }: { enabled: boolean; onChange: (next: boolean) => void }) {
  const [checked, setChecked] = useState(enabled)
  useEffect(() => setChecked(enabled), [enabled])

  return (
    <button
      onClick={() => {
        setChecked((c) => !c) // optimista: cambia al instante, sin esperar la vuelta del servidor
        onChange(!checked)
      }}
      role="switch"
      aria-checked={checked}
      className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-foreground' : 'bg-muted')}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  )
}
