import { EmailPasswordAuthForm } from './EmailPasswordAuthForm'

export function StudioLogin() {
  return (
    <EmailPasswordAuthForm
      portal="studio"
      logoSuffix="Studio"
      logoTheme="dark"
      signupTo="/studio/signup"
      forgotPasswordTo="/studio/forgot-password"
      successTo="/studio"
    />
  )
}
