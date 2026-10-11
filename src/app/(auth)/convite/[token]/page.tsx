import type { Metadata } from 'next'
import Link from 'next/link'
import { SubmitButton } from '@/components/ui'
import { INVITE_PROBLEM, isInviteToken } from '@/lib/invites'
import { ROLE_LABEL, isRole } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'
import { acceptInviteAction } from '../actions'

export const metadata: Metadata = { title: 'Convite', robots: { index: false, follow: false } }

export default async function InvitePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ erro?: string }> }) {
  const [{ token }, sp] = await Promise.all([params, searchParams])
  const problem = (reason: string) => (
    <>
      <h1>Convite indisponível</h1>
      <p className="notice notice-error" role="alert">{INVITE_PROBLEM[reason] ?? 'Não foi possível usar este convite.'}</p>
      <Link href="/" className="btn btn-ghost">Ir para o início</Link>
    </>
  )
  if (!isInviteToken(token)) return problem('not_found')

  const supabase = await createClient()
  const [{ data: preview }, { data: userData }] = await Promise.all([supabase.rpc('invite_preview', { p_token: token }), supabase.auth.getUser()])
  const p = preview as { valid: boolean; reason?: string; store_name?: string; role?: string } | null
  if (!p?.valid) return problem(p?.reason ?? 'not_found')

  const role = isRole(p.role) ? ROLE_LABEL[p.role].toLowerCase() : 'membro'
  const next = encodeURIComponent(`/convite/${token}`)
  const flash = sp.erro && INVITE_PROBLEM[sp.erro]

  return (
    <>
      <h1>Você foi convidada</h1>
      <p>Para ajudar a cuidar do catálogo da <strong>{p.store_name}</strong>, como <strong>{role}</strong>.</p>
      {flash && <p className="notice notice-error" role="alert">{flash}</p>}
      {userData.user ? (
        <form action={acceptInviteAction.bind(null, token)} className="stack">
          <p className="muted small">Você está logada como {userData.user.email}.</p>
          <SubmitButton pendingText="Entrando…">Entrar na equipe</SubmitButton>
        </form>
      ) : (
        <div className="stack">
          <p className="muted small">Para aceitar, entre na sua conta ou crie uma (é rápido). Depois você volta para este convite.</p>
          <Link href={`/entrar?next=${next}`} className="btn btn-primary">Entrar na minha conta</Link>
          <Link href={`/cadastro?next=${next}`} className="btn btn-ghost">Criar conta</Link>
        </div>
      )}
    </>
  )
}
