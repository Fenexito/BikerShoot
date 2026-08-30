import type { EventStatus } from '../types/db'

export const EVENT_STATUS_STYLE: Record<EventStatus, { label: string; dot: string; text: string }> = {
  activo: { label: 'Activo', dot: 'bg-emerald-500', text: 'text-emerald-500' },
  pausado: { label: 'Pausado', dot: 'bg-blue-500', text: 'text-blue-500' },
  cerrado: { label: 'Cerrado', dot: 'bg-muted-foreground', text: 'text-muted-foreground' },
}
