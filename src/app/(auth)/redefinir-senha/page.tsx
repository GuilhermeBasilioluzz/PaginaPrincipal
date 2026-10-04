import Link from 'next/link'
import { NewPasswordForm } from '@/components/AuthForms'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Nova senha' }

export default async function NewPasswordPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()

  if (!data.user) {
    return (
      <>
        <h1>Link expirado</h1>
        <p className="muted">O link de recuperação expirou ou já foi usado.</p>
        <Link href="/recuperar-senha" className="btn btn-ghost">Pedir um novo link</Link>
      </>
    )
  }
  return (
    <>
      <h1>Crie uma nova senha</h1>
      <NewPasswordForm />
    </>
  )
}
