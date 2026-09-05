import { EmailPasswordAuthForm } from './EmailPasswordAuthForm'

export function BikerLogin() {
  return (
    <EmailPasswordAuthForm
      portal="biker"
      logoLabel="MotoShots"
      signupTo="/signup"
      forgotPasswordTo="/forgot-password"
      successTo="/app"
    />
  )
}
