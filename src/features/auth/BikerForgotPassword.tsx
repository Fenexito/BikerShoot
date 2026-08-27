import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '../../ui/flat/Button'
import { Input } from '../../ui/flat/Input'
import { useAuth } from './AuthContext'

const schema = z.object({ email: z.string().email('Correo inválido') })
type FormValues = z.infer<typeof schema>

export function BikerForgotPassword() {
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
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-16 font-flat">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 inline-block text-2xl font-extrabold tracking-tight text-primary">
          MotoShots
        </Link>

        {sent ? (
          <>
            <span className="text-5xl">📬</span>
            <h1 className="mt-6 text-2xl font-bold tracking-tight">Revisa tu correo</h1>
            <p className="mt-3 text-muted-foreground">
              Si existe una cuenta con ese correo, te enviamos un enlace para restablecer tu contraseña.
            </p>
          </>
        ) : (
          <>
            <h1 className="mb-2 text-3xl font-bold tracking-tight">Recuperar contraseña</h1>
            <p className="mb-8 text-muted-foreground">Te enviaremos un enlace a tu correo.</p>

            <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
              <Input label="Correo" type="email" placeholder="tu@correo.com" error={errors.email?.message} {...register('email')} />
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <Button type="submit" size="lg" loading={isSubmitting} className="mt-2">
                Enviar enlace
              </Button>
            </form>
          </>
        )}

        <p className="mt-6 text-sm text-muted-foreground">
          <Link to="/login" className="font-semibold text-primary">Volver a iniciar sesión</Link>
        </p>
      </div>
    </div>
  )
}
