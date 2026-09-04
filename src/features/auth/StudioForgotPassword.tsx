import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '../../ui/studio/Button'
import { Input } from '../../ui/studio/Input'
import { useAuth } from './AuthContext'

const schema = z.object({ email: z.string().email('Correo inválido') })
type FormValues = z.infer<typeof schema>

export function StudioForgotPassword() {
  const { requestPasswordReset } = useAuth()
  const [sent, setSent] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (values: FormValues) => {
    setFormError(null)
    const { error } = await requestPasswordReset(values.email)
    if (error) {
      setFormError(error)
      return
    }
    setSent(true)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-10 inline-block text-xs uppercase tracking-wide text-muted-foreground">
          MotoShots Studio
        </Link>

        {sent ? (
          <>
            <span className="text-5xl">📬</span>
            <h1 className="mt-6 font-studio text-3xl font-bold tracking-tight2">Revisa tu correo</h1>
            <p className="mt-3 text-muted-foreground">
              Si existe una cuenta con ese correo, te enviamos un enlace para restablecer tu contraseña.
            </p>
          </>
        ) : (
          <>
            <h1 className="mb-3 font-studio text-4xl font-bold tracking-tight2">Recuperar contraseña</h1>
            <p className="mb-10 text-muted-foreground">Te enviaremos un enlace a tu correo.</p>

            <form className="flex flex-col gap-5" onSubmit={handleSubmit(onSubmit)}>
              <Input label="Correo" type="email" placeholder="tu@estudio.com" error={errors.email?.message} {...register('email')} />
              {formError && <p className="text-sm text-accent">{formError}</p>}
              <Button type="submit" variant="secondary" size="lg" loading={isSubmitting} className="mt-2 justify-center">
                Enviar enlace
              </Button>
            </form>
          </>
        )}

        <p className="mt-8 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Link to="/studio/login" className="text-accent">Volver a iniciar sesión</Link>
        </p>
      </div>
    </div>
  )
}
