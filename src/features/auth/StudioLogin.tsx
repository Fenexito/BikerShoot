import { EmailPasswordAuthForm } from './EmailPasswordAuthForm'
import { StudioLogo } from '../../ui/shared/Logo'

export function StudioLogin() {
  return (
    <EmailPasswordAuthForm
      portal="studio"
      logo={<StudioLogo theme="dark" className="h-16" />}
      signupTo="/studio/signup"
      forgotPasswordTo="/studio/forgot-password"
      successTo="/studio"
    />
  )
}
