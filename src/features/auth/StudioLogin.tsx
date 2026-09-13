import { EmailPasswordAuthForm } from './EmailPasswordAuthForm'
import { AuthLogo } from '../../ui/shared/Logo'

export function StudioLogin() {
  return (
    <EmailPasswordAuthForm
      portal="studio"
      logo={<AuthLogo variant="studio" theme="dark" />}
      signupTo="/studio/signup"
      forgotPasswordTo="/studio/forgot-password"
      successTo="/studio"
    />
  )
}
