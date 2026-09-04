import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../auth/AuthContext'
import { usePhotographerDetails, usePhotographerUsageBytes } from './usePhotographerDetails'
import { usePublicPhotographer, usePhotographerEvents, useFeaturedPhotographerPhotos, usePhotographerPhotoCount } from '../biker/usePublicData'
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
import { SocialLinks } from '../../ui/shared/SocialLinks'
import { IconVerified } from '../../ui/shared/icons'
import { useToastStore } from '../../ui/overlays/toastStore'
import DriftWall from '../../ui/reactbits/DriftWall'
import { cn } from '../../lib/cn'

const schema = z.object({
  displayName: z.string().min(2, 'Ingresa el nombre de tu estudio'),
  city: z.string().optional(),
  whatsapp: z.string().optional(),
  bio: z.string().optional(),
  instagramUrl: z.string().optional(),
  facebookUrl: z.string().optional(),
  tiktokUrl: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

function formatBytes(n: number) {
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(0)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export function StudioProfilePage() {
  const { user, profile, refreshProfile } = useAuth()
  const { data: details } = usePhotographerDetails(user?.id)
  const { data: usageBytes = 0 } = usePhotographerUsageBytes(user?.id)
  const { data: photographer, isLoading } = usePublicPhotographer(user?.id)
  const { data: events = [] } = usePhotographerEvents(user?.id)
  const { data: featuredPhotos = [] } = useFeaturedPhotographerPhotos(user?.id)
  const { data: photoCount = 0 } = usePhotographerPhotoCount(user?.id)
  const push = useToastStore((s) => s.push)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [editing, setEditing] = useState(false)
  const [tab, setTab] = useState<'destacadas' | 'eventos'>('destacadas')

  async function handleCoverFile(file: File | undefined) {
    if (!file || !user) return
    if (!file.type.startsWith('image/')) {
      push({ type: 'error', title: 'La portada debe ser una imagen' })
      return
    }
    setUploadingCover(true)
    try {
      const { data: signed, error: signError } = await supabase.functions.invoke('r2-profile-cover-upload-url', {
        body: { fileName: file.name, contentType: file.type },
      })
      if (signError || !signed?.uploadUrl) throw new Error(signError?.message ?? 'No se pudo obtener la URL de subida')

      const putRes = await fetch(signed.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
      if (!putRes.ok) throw new Error(`R2 respondió ${putRes.status}`)

      const { error: updateError } = await supabase
        .from('photographer_details')
        .update({ profile_cover_path: signed.coverPath })
        .eq('profile_id', user.id)
      if (updateError) throw updateError

      queryClient.invalidateQueries({ queryKey: ['photographer_details', user.id] })
      queryClient.invalidateQueries({ queryKey: ['public-photographer', user.id] })
      push({ type: 'success', title: 'Portada actualizada' })
    } catch (err) {
      push({ type: 'error', title: 'No se pudo actualizar la portada', description: (err as Error).message })
    } finally {
      setUploadingCover(false)
    }
  }

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
        instagramUrl: details?.instagram_url ?? '',
        facebookUrl: details?.facebook_url ?? '',
        tiktokUrl: details?.tiktok_url ?? '',
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
      .update({
        city: values.city || null,
        whatsapp: values.whatsapp || null,
        bio: values.bio || null,
        instagram_url: values.instagramUrl || null,
        facebook_url: values.facebookUrl || null,
        tiktok_url: values.tiktokUrl || null,
      })
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
  const limitBytes = details?.storage_plan ? details.storage_plan.gb_limit * 1024 * 1024 * 1024 : 0
  const pct = limitBytes > 0 ? Math.min(100, (usageBytes / limitBytes) * 100) : 0

  return (
    <div>
      {/* Banner — misma estructura que el perfil público que ve el biker (PhotographerProfile.tsx) */}
      <button
        onClick={() => coverInputRef.current?.click()}
        disabled={uploadingCover}
        className="group relative flex h-48 w-full items-center justify-center overflow-hidden bg-muted md:h-64"
      >
        {details?.profile_cover_path ? (
          <img src={r2Url(details.profile_cover_path)} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span className="text-6xl opacity-20">🏍️</span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs font-semibold uppercase tracking-wide text-white opacity-0 transition-opacity group-hover:opacity-100">
          {uploadingCover ? 'Subiendo…' : 'Cambiar portada'}
        </span>
      </button>
      <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleCoverFile(e.target.files?.[0])} />

      <div className={STUDIO_PAGE_WIDE}>
        <div className="-mt-16 flex flex-col items-center gap-4 sm:flex-row sm:items-end">
          <button onClick={() => avatarInputRef.current?.click()} className="group relative h-28 w-28 shrink-0 rounded-full" disabled={uploadingAvatar}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={profile.display_name} className="h-28 w-28 rounded-full border-4 border-background object-cover shadow-sm" />
            ) : (
              <InitialsAvatar name={profile.display_name || 'S'} className="h-28 w-28 rounded-full border-4 border-background bg-foreground text-2xl text-background shadow-sm" />
            )}
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 text-[10px] font-semibold uppercase tracking-wide text-white opacity-0 transition-opacity group-hover:opacity-100">
              {uploadingAvatar ? '…' : 'Cambiar'}
            </span>
          </button>
          <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleAvatarFile(e.target.files?.[0])} />

          <div className="flex-1 text-center sm:text-left">
            <div className="flex items-center justify-center gap-2 sm:justify-start">
              <h1 className="font-studio text-3xl font-bold tracking-tight2">{profile.display_name}</h1>
              {details?.approved && <IconVerified className="h-6 w-6 shrink-0" aria-label="Fotógrafo verificado" />}
            </div>
            <p className="text-muted-foreground">{photographer.city || 'Sin ciudad configurada'}</p>
            <SocialLinks
              instagramUrl={photographer.instagram_url}
              facebookUrl={photographer.facebook_url}
              tiktokUrl={photographer.tiktok_url}
              className="mt-2 justify-center sm:justify-start"
            />
          </div>

          <Button variant={editing ? 'secondary' : 'primary'} onClick={() => setEditing((e) => !e)}>
            {editing ? 'Cancelar' : 'Editar perfil'}
          </Button>
        </div>

        {!details?.approved && (
          <p className="mt-6 rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Tu cuenta está en revisión. Podrás publicar eventos y vender fotos en cuanto un administrador la apruebe.
          </p>
        )}

        <div className="mt-8 flex flex-wrap gap-4">
          <div className="grid grid-cols-2 gap-4 rounded-3xl border border-border bg-card px-6 py-5 text-center sm:w-72">
            <div>
              <p className="text-2xl font-bold">{events.length}</p>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Rodadas cubiertas</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{photoCount}</p>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Fotos publicadas</p>
            </div>
          </div>

          {details?.storage_plan && (
            <div className="flex-1 rounded-3xl border border-border bg-card px-6 py-5" style={{ minWidth: 240 }}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Almacenamiento · Plan {details.storage_plan.name}
                </p>
                <Link to="/studio/planes" className="text-[11px] font-semibold uppercase tracking-wide text-accent hover:underline">
                  Ver planes →
                </Link>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className={cn('h-full rounded-full transition-all', pct > 90 ? 'bg-red-500' : 'bg-accent')} style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {formatBytes(usageBytes)} de {details.storage_plan.gb_limit} GB usados
              </p>
            </div>
          )}
        </div>

        {editing ? (
          <form className="mt-8 flex flex-col gap-5 rounded-3xl border border-border bg-card p-6 sm:p-8" onSubmit={handleSubmit(onSubmit)}>
            <p className="text-sm text-muted-foreground">Esto es lo que ve un biker en tu perfil público.</p>
            <div className="grid gap-5 sm:grid-cols-2">
              <Input label="Nombre del estudio" error={errors.displayName?.message} {...register('displayName')} />
              <Input label="Ciudad" {...register('city')} />
              <Input label="WhatsApp de contacto" {...register('whatsapp')} />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sobre ti</label>
              <textarea
                rows={4}
                className="rounded-2xl border border-border bg-input px-4 py-3 text-base text-foreground outline-none transition-colors duration-150 focus:border-accent"
                {...register('bio')}
              />
            </div>
            <div>
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Redes sociales (opcional)</p>
              <div className="grid gap-5 sm:grid-cols-3">
                <Input label="Instagram" placeholder="https://instagram.com/tu_estudio" {...register('instagramUrl')} />
                <Input label="Facebook" placeholder="https://facebook.com/tu_estudio" {...register('facebookUrl')} />
                <Input label="TikTok" placeholder="https://tiktok.com/@tu_estudio" {...register('tiktokUrl')} />
              </div>
            </div>
            <Button type="submit" size="lg" loading={isSubmitting} className="mt-2 w-fit">
              Guardar cambios
            </Button>
          </form>
        ) : (
          photographer.bio && <p className="mt-6 max-w-2xl text-muted-foreground">{photographer.bio}</p>
        )}

        <div className="mt-8 flex flex-wrap gap-2">
          <button
            onClick={() => setTab('destacadas')}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-medium transition-colors',
              tab === 'destacadas' ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground hover:bg-border hover:text-foreground',
            )}
          >
            Fotos destacadas
          </button>
          <button
            onClick={() => setTab('eventos')}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-medium transition-colors',
              tab === 'eventos' ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground hover:bg-border hover:text-foreground',
            )}
          >
            Eventos ({events.length})
          </button>
        </div>

        <div className="py-8">
          {tab === 'destacadas' ? (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                Para destacar una foto aquí, márcala al entregar el archivo final en un pedido — así solo se muestran
                fotos que ya editaste y entregaste, no las miles que puedas tener subidas.
              </p>
              {featuredPhotos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Todavía no has destacado ninguna foto.</p>
              ) : (
                <div className="relative left-1/2 right-1/2 -mx-[50vw] w-screen" style={{ height: '75vh', minHeight: 480 }}>
                  <DriftWall
                    items={featuredPhotos.map((p) => ({ image: previewUrl(p) }))}
                    columns={Math.min(8, Math.max(3, featuredPhotos.length))}
                    tileWidth={220}
                    tileHeight={220}
                    gap={6}
                    radius={0}
                    tilt={16}
                    turn={-14}
                    perspective={950}
                    depth={100}
                    speed={22}
                    variance={0.5}
                    parallax={0.5}
                    lift={48}
                    fade={0.15}
                    dim={0.92}
                    overlayColor="transparent"
                  />
                </div>
              )}
            </>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => {
                const statusStyle = EVENT_STATUS_STYLE[event.status]
                return (
                  <Link key={event.id} to={`/studio/eventos/${event.id}`} className="rounded-3xl border border-border bg-card p-5 transition-all hover:border-accent/40 hover:shadow-sm">
                    <div className="flex items-center justify-between">
                      <Badge>{event.category}</Badge>
                      <StatusPill dot={statusStyle.dot} text={statusStyle.text} label={statusStyle.label} className="text-[11px]" />
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
    </div>
  )
}
