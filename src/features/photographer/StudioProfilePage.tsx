import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../auth/AuthContext'
import { usePhotographerDetails, usePhotographerUsageBytes } from './usePhotographerDetails'
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'
import { r2Url } from '../../lib/r2'
import { Button } from '../../ui/studio/Button'
import { Input } from '../../ui/studio/Input'
import { Badge } from '../../ui/studio/Badge'
import { InitialsAvatar } from '../../ui/shared/InitialsAvatar'
import { useToastStore } from '../../ui/overlays/toastStore'

const schema = z.object({
  displayName: z.string().min(2, 'Ingresa el nombre de tu estudio'),
  city: z.string().optional(),
  whatsapp: z.string().optional(),
  bio: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

export function StudioProfilePage() {
  const { user, profile, refreshProfile } = useAuth()
  const { data: details, isLoading } = usePhotographerDetails(user?.id)
  const { data: usageBytes = 0 } = usePhotographerUsageBytes(user?.id)
  const push = useToastStore((s) => s.push)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

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
    push({ type: 'success', title: 'Perfil actualizado' })
  }

  if (isLoading || !profile) {
    return <div className="px-6 py-16 text-center text-muted-foreground">Cargando perfil…</div>
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-foreground">
      <div className="mb-10 flex items-center gap-5">
        <button onClick={() => avatarInputRef.current?.click()} className="group relative h-20 w-20 shrink-0" disabled={uploadingAvatar}>
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url.startsWith('http') ? profile.avatar_url : r2Url(profile.avatar_url)}
              alt={profile.display_name}
              className="h-20 w-20 rounded-full object-cover"
            />
          ) : (
            <InitialsAvatar name={profile.display_name || 'S'} className="h-20 w-20 bg-foreground text-2xl text-background" />
          )}
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 text-[10px] font-semibold uppercase tracking-wider2 text-white opacity-0 transition-opacity group-hover:opacity-100">
            {uploadingAvatar ? '…' : 'Cambiar'}
          </span>
        </button>
        <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleAvatarFile(e.target.files?.[0])} />
        <div>
          <h1 className="font-studio text-2xl font-bold tracking-tight2">{profile.display_name}</h1>
          <p className="text-muted-foreground">{user?.email}</p>
        </div>
        {details?.approved ? (
          <Badge className="ml-auto border-accent text-accent">Aprobado para vender</Badge>
        ) : (
          <Badge className="ml-auto">Pendiente de aprobación</Badge>
        )}
      </div>

      {!details?.approved && (
        <p className="mb-8 border border-border px-4 py-3 text-sm text-muted-foreground">
          Tu cuenta está en revisión. Podrás publicar eventos y vender fotos en cuanto un
          administrador la apruebe.
        </p>
      )}

      {details?.storage_plan && (
        <div className="mb-8 border border-border p-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-studio text-lg font-bold">Almacenamiento</p>
            <span className="font-studio-mono text-xs uppercase tracking-wider2 text-accent">
              Plan {details.storage_plan.name}
            </span>
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

      <form className="flex flex-col gap-5" onSubmit={handleSubmit(onSubmit)}>
        <Input label="Nombre del estudio" error={errors.displayName?.message} {...register('displayName')} />
        <Input label="Ciudad" {...register('city')} />
        <Input label="WhatsApp de contacto" {...register('whatsapp')} />

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium uppercase tracking-wider2 text-muted-foreground">Sobre ti</label>
          <textarea
            rows={4}
            className="border border-border bg-input px-4 py-3 text-base text-foreground outline-none transition-colors duration-150 focus:border-accent"
            {...register('bio')}
          />
        </div>

        <Button type="submit" variant="secondary" size="lg" loading={isSubmitting} className="mt-2 justify-center">
          Guardar cambios
        </Button>
      </form>
    </div>
  )
}
