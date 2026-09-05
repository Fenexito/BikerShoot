import { EmailPasswordAuthForm } from './EmailPasswordAuthForm'

export function StudioLogin() {
  return (
    <EmailPasswordAuthForm
      portal="studio"
      logoLabel="MotoShots Studio"
      signupTo="/studio/signup"
      forgotPasswordTo="/studio/forgot-password"
      successTo="/studio"
    />
  )
}
