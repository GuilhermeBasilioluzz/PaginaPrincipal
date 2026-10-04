import Link from 'next/link'
import { ResetRequestForm } from '@/components/AuthForms'

export const metadata = { title: 'Recuperar senha' }

export default function ResetPage() {
  return (
    <>
      <h1>Recuperar senha</h1>
      <ResetRequestForm />
      <p className="muted small"><Link href="/entrar" className="link">Voltar para entrar</Link></p>
    </>
  )
}
