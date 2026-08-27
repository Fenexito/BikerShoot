import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '../../ui/studio/Button'
import { Input } from '../../ui/studio/Input'
import { useAuth } from './AuthContext'

const schema = z.object({
  email: z.string().email('Correo inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})
type FormValues = z.infer<typeof schema>

export function StudioLogin() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (values: FormValues) => {
    setFormError(null)
    const { error } = await signIn(values.email, values.password, 'studio')
    if (error) {
      setFormError(error)
      return
    }
    navigate('/studio')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-10 inline-block font-studio-mono text-xs uppercase tracking-widest2 text-muted-foreground">
          MotoShots Studio
        </Link>
        <h1 className="mb-3 font-studio text-4xl font-bold tracking-tight2">Acceso de estudio</h1>
        <p className="mb-10 text-muted-foreground">Gestiona tus eventos, pedidos y cobros.</p>

        <form className="flex flex-col gap-5" onSubmit={handleSubmit(onSubmit)}>
          <Input label="Correo" type="email" placeholder="tu@estudio.com" error={errors.email?.message} {...register('email')} />
          <Input label="Contraseña" type="password" placeholder="••••••••" error={errors.password?.message} {...register('password')} />
          <Link to="/studio/forgot-password" className="-mt-3 self-end font-studio-mono text-xs uppercase tracking-wider2 text-muted-foreground hover:text-accent">
            ¿Olvidaste tu contraseña?
          </Link>

          {formError && <p className="text-sm text-accent">{formError}</p>}

          <Button type="submit" variant="secondary" size="lg" loading={isSubmitting} className="mt-2 justify-center">
            Entrar
          </Button>
        </form>

        <p className="mt-8 font-studio-mono text-xs uppercase tracking-wider2 text-muted-foreground">
          ¿No tienes cuenta? <Link to="/studio/signup" className="text-accent">Regístrate</Link>
        </p>
        <p className="mt-3 font-studio-mono text-xs uppercase tracking-wider2 text-muted-foreground">
          ¿Eres biker? <Link to="/login" className="text-accent">Ir al sitio principal</Link>
        </p>
      </div>
    </div>
  )
}
