import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '../../ui/flat/Button'
import { Input } from '../../ui/flat/Input'
import { useAuth } from './AuthContext'

const schema = z.object({
  email: z.string().email('Correo inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})
type FormValues = z.infer<typeof schema>

export function BikerLogin() {
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
    const { error } = await signIn(values.email, values.password)
    if (error) {
      setFormError(error)
      return
    }
    navigate('/app')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-16 font-flat">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 inline-block text-2xl font-extrabold tracking-tight text-primary">
          MotoShots
        </Link>
        <h1 className="mb-2 text-3xl font-bold tracking-tight">Bienvenido de vuelta</h1>
        <p className="mb-8 text-muted-foreground">Entra para ver y comprar tus fotos.</p>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <Input label="Correo" type="email" placeholder="tu@correo.com" error={errors.email?.message} {...register('email')} />
          <Input label="Contraseña" type="password" placeholder="••••••••" error={errors.password?.message} {...register('password')} />

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <Button type="submit" size="lg" loading={isSubmitting} className="mt-2">
            Iniciar sesión
          </Button>
        </form>

        <p className="mt-6 text-sm text-muted-foreground">
          ¿No tienes cuenta? <Link to="/signup" className="font-semibold text-primary">Crear cuenta</Link>
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          ¿Eres fotógrafo? <Link to="/studio/login" className="font-semibold text-primary">Entra a Studio</Link>
        </p>
      </div>
    </div>
  )
}
