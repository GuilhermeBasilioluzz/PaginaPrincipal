import Link from 'next/link'
import { LoginForms } from '@/components/AuthForms'
import { safeNext } from '@/lib/safeNext'

export const metadata = { title: 'Entrar' }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; erro?: string }> }) {
  const { next, erro } = await searchParams
  return (
    <>
      <h1>Entrar</h1>
      {erro === 'link' && (
        <p className="notice notice-error" role="alert">Este link expirou ou já foi usado. Peça um novo.</p>
      )}
      <LoginForms next={safeNext(next)} />
      <p className="muted small">
        Ainda não tem conta? <Link href="/cadastro" className="link">Criar conta</Link>
      </p>
    </>
  )
}
