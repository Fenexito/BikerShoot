import { EmailPasswordAuthForm } from './EmailPasswordAuthForm'

export function BikerLogin() {
  return (
    <EmailPasswordAuthForm
      portal="biker"
      signupTo="/signup"
      forgotPasswordTo="/forgot-password"
      successTo="/app"
    />
  )
}
