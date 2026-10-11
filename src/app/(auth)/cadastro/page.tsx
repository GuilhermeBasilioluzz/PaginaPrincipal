import Link from 'next/link'
import { SignUpForm } from '@/components/AuthForms'
import { safeNext } from '@/lib/safeNext'

export const metadata = { title: 'Criar conta' }

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next)
  return (
    <>
      <h1>Criar conta</h1>
      <SignUpForm next={next} />
      <p className="muted small">
        Já tem conta? <Link href={next === '/app' ? '/entrar' : `/entrar?next=${encodeURIComponent(next)}`} className="link">Entrar</Link>
      </p>
    </>
  )
}
