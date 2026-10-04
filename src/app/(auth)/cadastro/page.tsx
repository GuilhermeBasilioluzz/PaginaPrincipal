import Link from 'next/link'
import { SignUpForm } from '@/components/AuthForms'

export const metadata = { title: 'Criar conta' }

export default function SignUpPage() {
  return (
    <>
      <h1>Criar conta</h1>
      <SignUpForm />
      <p className="muted small">
        Já tem conta? <Link href="/entrar" className="link">Entrar</Link>
      </p>
    </>
  )
}
