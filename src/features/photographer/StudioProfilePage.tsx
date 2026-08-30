import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../auth/AuthContext'
import { usePhotographerDetails, usePhotographerUsageBytes } from './usePhotographerDetails'
import { usePublicPhotographer, usePhotographerEvents, usePhotographerPhotos } from '../biker/usePublicData'
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'
import { r2Url, previewUrl } from '../../lib/r2'
import { EVENT_STATUS_STYLE } from '../../lib/eventStatus'
import { Button } from '../../ui/studio/Button'
import { Input } from '../../ui/studio/Input'
import { Badge } from '../../ui/studio/Badge'
import { StatusPill } from '../../ui/shared/StatusPill'
import { STUDIO_PAGE_WIDE } from '../../ui/studio/layout'
import { InitialsAvatar } from '../../ui/shared/InitialsAvatar'
import { useToastStore } from '../../ui/overlays/toastStore'
import { cn } from '../../lib/cn'

const schema = z.object({
  displayName: z.string().min(2, 'Ingresa el nombre de tu estudio'),
  city: z.string().optional(),
  whatsapp: z.string().optional(),
  bio: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

export function StudioProfilePage() {
  const { user, profile, refreshProfile } = useAuth()
  const { data: details } = usePhotographerDetails(user?.id)
  const { data: usageBytes = 0 } = usePhotographerUsageBytes(user?.id)
  const { data: photographer, isLoading } = usePublicPhotographer(user?.id)
  const { data: events = [] } = usePhotographerEvents(user?.id)
  const { data: photos = [] } = usePhotographerPhotos(user?.id)
  const push = useToastStore((s) => s.push)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [editing, setEditing] = useState(false)
  const [tab, setTab] = useState<'destacadas' | 'eventos'>('destacadas')

  const featuredPhotos = useMemo(() => {
    const featured = photos.filter((p) => p.featured)
    return featured.length > 0 ? featured : photos
  }, [photos])

  async function handleAvatarFile(file: File | undefined) {
    if (!file || !user) return
    if (!file.type.startsWith('image/')) {
      push({ type: 'error', title: 'La foto de perfil debe ser una imagen' })
      return
    }
    setUploadingAvatar(true)
    try {
      const { data: signed, error: signError } = await supabase.functions.invoke('r2-avatar-upload-url', {
        body: { fileName: file.name, contentType: file.type },
      })
      if (signError || !signed?.uploadUrl) throw new Error(signError?.message ?? 'No se pudo obtener la URL de subida')

      const putRes = await fetch(signed.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
      if (!putRes.ok) throw new Error(`R2 respondió ${putRes.status}`)

      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: signed.avatarPath }).eq('id', user.id)
      if (updateError) throw updateError

      await refreshProfile()
      queryClient.invalidateQueries({ queryKey: ['public-photographer', user.id] })
      push({ type: 'success', title: 'Foto de perfil actualizada' })
    } catch (err) {
      push({ type: 'error', title: 'No se pudo actualizar la foto', description: (err as Error).message })
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function toggleFeatured(photoId: string, next: boolean) {
    const { error } = await supabase.from('photos').update({ featured: next }).eq('id', photoId)
    if (error) {
      push({ type: 'error', title: 'No se pudo actualizar', description: error.message })
      return
    }
    queryClient.invalidateQueries({ queryKey: ['photographer-photos', user?.id] })
  }

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (profile) {
      reset({
        displayName: profile.display_name,
        city: details?.city ?? '',
        whatsapp: details?.whatsapp ?? '',
        bio: details?.bio ?? '',
      })
    }
  }, [profile, details, reset])

  const onSubmit = async (values: FormValues) => {
    if (!user) return

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ display_name: values.displayName })
      .eq('id', user.id)

    const { error: detailsError } = await supabase
      .from('photographer_details')
      .update({ city: values.city || null, whatsapp: values.whatsapp || null, bio: values.bio || null })
      .eq('profile_id', user.id)

    if (profileError || detailsError) {
      push({ type: 'error', title: 'No se pudo guardar', description: profileError?.message ?? detailsError?.message })
      return
    }

    await refreshProfile()
    queryClient.invalidateQueries({ queryKey: ['photographer_details', user.id] })
    queryClient.invalidateQueries({ queryKey: ['public-photographer', user.id] })
    push({ type: 'success', title: 'Perfil actualizado' })
    setEditing(false)
  }

  if (isLoading || !profile || !photographer) {
    return <div className="px-6 py-16 text-center text-muted-foreground">Cargando perfil…</div>
  }

  const avatarUrl = profile.avatar_url ? (profile.avatar_url.startsWith('http') ? profile.avatar_url : r2Url(profile.avatar_url)) : null

  return (
    <div className={STUDIO_PAGE_WIDE}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-5">
          <button onClick={() => avatarInputRef.current?.click()} className="group relative h-24 w-24 shrink-0" disabled={uploadingAvatar}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={profile.display_name} className="h-24 w-24 rounded-full object-cover" />
            ) : (
              <InitialsAvatar name={profile.display_name || 'S'} className="h-24 w-24 bg-foreground text-2xl text-background" />
            )}
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 text-[10px] font-semibold uppercase tracking-wider2 text-white opacity-0 transition-opacity group-hover:opacity-100">
              {uploadingAvatar ? '…' : 'Cambiar'}
            </span>
          </button>
          <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleAvatarFile(e.target.files?.[0])} />
          <div>
            <h1 className="font-studio text-3xl font-bold tracking-tight2">{profile.display_name}</h1>
            <p className="text-muted-foreground">{photographer.city || 'Sin ciudad configurada'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {details?.approved ? (
            <Badge className="border-accent text-accent">Aprobado para vender</Badge>
          ) : (
            <Badge>Pendiente de aprobación</Badge>
          )}
          <Button variant={editing ? 'secondary' : 'primary'} onClick={() => setEditing((e) => !e)}>
            {editing ? 'Cancelar' : 'Editar perfil'}
          </Button>
        </div>
      </div>

      {!details?.approved && (
        <p className="mt-6 border border-border px-4 py-3 text-sm text-muted-foreground">
          Tu cuenta está en revisión. Podrás publicar eventos y vender fotos en cuanto un administrador la apruebe.
        </p>
      )}

      {details?.storage_plan && (
        <div className="mt-6 border border-border p-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-studio text-lg font-bold">Almacenamiento</p>
            <span className="font-studio-mono text-xs uppercase tracking-wider2 text-accent">Plan {details.storage_plan.name}</span>
          </div>
          {(() => {
            const limitBytes = details.storage_plan.gb_limit * 1024 * 1024 * 1024
            const pct = limitBytes > 0 ? Math.min(100, (usageBytes / limitBytes) * 100) : 0
            const usedGB = (usageBytes / 1024 / 1024 / 1024).toFixed(2)
            return (
              <>
                <div className="h-2 w-full overflow-hidden bg-muted">
                  <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {usedGB} GB de {details.storage_plan.gb_limit} GB usados
                  {details.storage_plan.price_monthly_gtq > 0 && ` · Q${details.storage_plan.price_monthly_gtq}/mes`}
                </p>
              </>
            )
          })()}
        </div>
      )}

      {editing ? (
        <form className="mt-8 flex flex-col gap-5 border-t border-border pt-8" onSubmit={handleSubmit(onSubmit)}>
          <p className="text-sm text-muted-foreground">Esto es lo que ve un biker en tu perfil público.</p>
          <div className="grid gap-5 sm:grid-cols-2">
            <Input label="Nombre del estudio" error={errors.displayName?.message} {...register('displayName')} />
            <Input label="Ciudad" {...register('city')} />
            <Input label="WhatsApp de contacto" {...register('whatsapp')} />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium uppercase tracking-wider2 text-muted-foreground">Sobre ti</label>
            <textarea
              rows={4}
              className="border border-border bg-input px-4 py-3 text-base text-foreground outline-none transition-colors duration-150 focus:border-accent"
              {...register('bio')}
            />
          </div>
          <Button type="submit" size="lg" loading={isSubmitting} className="mt-2 w-fit">
            Guardar cambios
          </Button>
        </form>
      ) : (
        photographer.bio && <p className="mt-6 max-w-2xl text-muted-foreground">{photographer.bio}</p>
      )}

      <div className="mt-10 grid grid-cols-2 gap-4 border-y border-border py-6 text-center sm:w-80">
        <div>
          <p className="font-studio text-2xl font-bold">{events.length}</p>
          <p className="font-studio-mono text-[10px] uppercase text-muted-foreground">Eventos</p>
        </div>
        <div>
          <p className="font-studio text-2xl font-bold">{photos.length}</p>
          <p className="font-studio-mono text-[10px] uppercase text-muted-foreground">Fotos</p>
        </div>
      </div>

      <div className="mt-8 flex gap-1 border-b border-border">
        <button
          onClick={() => setTab('destacadas')}
          className={cn(
            'border-b-2 px-4 py-3 font-studio-mono text-xs uppercase tracking-wider2 transition-colors',
            tab === 'destacadas' ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {editing ? 'Curar destacadas' : 'Fotos destacadas'}
        </button>
        <button
          onClick={() => setTab('eventos')}
          className={cn(
            'border-b-2 px-4 py-3 font-studio-mono text-xs uppercase tracking-wider2 transition-colors',
            tab === 'eventos' ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          Eventos ({events.length})
        </button>
      </div>

      <div className="py-8">
        {tab === 'destacadas' ? (
          <>
            {editing && (
              <p className="mb-4 text-sm text-muted-foreground">
                Marca ★ las fotos que quieres mostrar en tu perfil público. Sin ninguna marcada, se muestran todas.
              </p>
            )}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {(editing ? photos : featuredPhotos).map((photo) => (
                <div key={photo.id} className="group relative aspect-[4/5] overflow-hidden border border-border">
                  <img src={previewUrl(photo)} alt="" className="h-full w-full object-cover" />
                  {editing && (
                    <button
                      onClick={() => toggleFeatured(photo.id, !photo.featured)}
                      aria-label="Destacar en tu perfil"
                      className={cn(
                        'absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full text-sm transition-opacity',
                        photo.featured ? 'bg-accent text-white opacity-100' : 'bg-black/60 text-white opacity-0 group-hover:opacity-100',
                      )}
                    >
                      ★
                    </button>
                  )}
                </div>
              ))}
              {photos.length === 0 && <p className="col-span-full text-sm text-muted-foreground">Todavía no tienes fotos publicadas.</p>}
            </div>
          </>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => {
              const statusStyle = EVENT_STATUS_STYLE[event.status]
              return (
                <Link key={event.id} to={`/studio/eventos/${event.id}`} className="border border-border p-4 transition-colors hover:border-border-hover">
                  <div className="flex items-center justify-between">
                    <Badge>{event.category}</Badge>
                    <StatusPill dot={statusStyle.dot} text={statusStyle.text} label={statusStyle.label} className="font-studio-mono text-[10px] uppercase tracking-wider2" />
                  </div>
                  <p className="mt-3 font-semibold">{event.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{event.city} · {new Date(event.event_date).toLocaleDateString('es-GT', { day: '2-digit', month: 'short' })}</p>
                </Link>
              )
            })}
            {events.length === 0 && <p className="text-sm text-muted-foreground">Todavía no tienes eventos.</p>}
          </div>
        )}
      </div>
    </div>
  )
}
