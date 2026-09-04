import { useState } from 'react'
import { SkeletonRows } from '../../ui/shared/Skeleton'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'
import { Input } from '../../ui/flat/Input'
import { Button } from '../../ui/flat/Button'
import { Card } from '../../ui/flat/Card'
import { Badge } from '../../ui/flat/Badge'
import { useToastStore } from '../../ui/overlays/toastStore'
import type { Release } from '../changelog/types'

async function fetchReleases(): Promise<Release[]> {
  const { data, error } = await supabase.from('releases').select('*').order('released_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export function ReleasesAdmin() {
  const push = useToastStore((s) => s.push)
  const { data: releases = [], isLoading } = useQuery({ queryKey: ['admin-releases'], queryFn: fetchReleases })

  const [version, setVersion] = useState('')
  const [notes, setNotes] = useState('')
  const [highlightsText, setHighlightsText] = useState('')
  const [saving, setSaving] = useState(false)

  async function publish() {
    if (!version.trim()) {
      push({ type: 'error', title: 'Ponle un número de versión' })
      return
    }
    setSaving(true)
    const highlights = highlightsText.split('\n').map((h) => h.trim()).filter(Boolean)

    const { data: authorData } = await supabase.auth.getUser()
    const { error } = await supabase.from('releases').insert({
      version,
      notes,
      highlights,
      author: authorData.user?.email ?? 'admin',
    })

    if (error) {
      push({ type: 'error', title: 'No se pudo publicar', description: error.message })
      setSaving(false)
      return
    }

    push({ type: 'success', title: `v${version} publicada` })
    setVersion('')
    setNotes('')
    setHighlightsText('')
    setSaving(false)
    queryClient.invalidateQueries({ queryKey: ['admin-releases'] })
    queryClient.invalidateQueries({ queryKey: ['releases'] })
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-16 font-flat">
      <h1 className="mb-2 text-3xl font-bold tracking-tight">Publicar release</h1>
      <p className="mb-8 text-muted-foreground">Se muestra públicamente en /changelog.</p>

      <Card className="mb-12">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Versión" placeholder="Ej. 0.5.0" value={version} onChange={(e) => setVersion(e.target.value)} />
        </div>
        <div className="mt-4 flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">Notas</label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="rounded-full border-2 border-transparent bg-muted px-4 py-2 text-sm outline-none transition-colors focus:border-primary focus:bg-background"
            placeholder="Resumen breve de esta versión..."
          />
        </div>
        <div className="mt-4 flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">Puntos destacados (uno por línea)</label>
          <textarea
            rows={4}
            value={highlightsText}
            onChange={(e) => setHighlightsText(e.target.value)}
            className="rounded-full border-2 border-transparent bg-muted px-4 py-2 text-sm outline-none transition-colors focus:border-primary focus:bg-background"
            placeholder={'Carrito funcionando\nPerfil de fotógrafo\nMapa de puntos'}
          />
        </div>
        <Button className="mt-6" loading={saving} onClick={publish}>
          Publicar
        </Button>
      </Card>

      <h2 className="mb-4 text-xl font-bold tracking-tight">Historial</h2>
      {isLoading && <SkeletonRows count={4} />}
      <div className="flex flex-col gap-4">
        {releases.map((r) => (
          <Card key={r.id}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-lg font-semibold">v{r.version}</h3>
              <Badge tone="secondary">{new Date(r.released_at).toLocaleDateString('es-GT')}</Badge>
            </div>
            {r.notes && <p className="mb-2 text-sm text-muted-foreground">{r.notes}</p>}
            {r.highlights?.length > 0 && (
              <ul className="list-inside list-disc text-sm text-muted-foreground">
                {r.highlights.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
