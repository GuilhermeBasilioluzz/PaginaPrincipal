import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMembership, requireUser } from '@/lib/session'
import { ROLE_LABEL, ROLES, can } from '@/lib/permissions'
import type { TeamMember } from '@/lib/types'
import { SubmitButton, Field } from '@/components/ui'
import { addMemberAction, changeRoleAction, removeMemberAction } from '../../actions'

export const metadata = { title: 'Equipe' }

const FLASH: Record<string, string> = {
  added: 'Membro adicionado.',
  role: 'Papel atualizado.',
  removed: 'Membro removido.',
  user_not_found: 'Não encontramos uma conta com este e-mail. Peça para a pessoa criar uma conta no Hyperion primeiro.',
  already_member: 'Esta pessoa já faz parte da equipe.',
  last_owner: 'A loja precisa ter pelo menos um dono.',
  forbidden: 'Você não tem permissão para fazer isso.',
  invalid: 'Confira os dados informados.',
  generic: 'Algo deu errado. Tente novamente.',
}

export default async function TeamPage({ params, searchParams }: {
  params: Promise<{ store: string }>
  searchParams: Promise<{ ok?: string; erro?: string }>
}) {
  const [{ store: slug }, { ok, erro }] = await Promise.all([params, searchParams])
  const user = await requireUser()
  const membership = await getMembership(slug)
  if (!membership) notFound()
  const { store, role } = membership
  const manage = can(role, 'manage_team') && store.is_active

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('store_team', { p_store: store.id })
  const team = (data ?? []) as TeamMember[]
  const flash = (erro && FLASH[erro]) || (ok && FLASH[ok]) || null

  return (
    <div className="stack-lg">
      {flash && <p className={`notice ${erro ? 'notice-error' : 'notice-ok'}`} role={erro ? 'alert' : 'status'}>{flash}</p>}
      {error && <p className="notice notice-error" role="alert">Não foi possível carregar a equipe.</p>}

      <div className="card">
        <h2>Equipe</h2>
        <ul className="list">
          {team.map((m) => (
            <li key={m.user_id} className="member">
              <div>
                <strong>{m.full_name || m.email || 'Sem nome'}{m.user_id === user.id && ' (você)'}</strong>
                {m.email && <span className="muted small"> {m.email}</span>}
              </div>
              {manage ? (
                <div className="row">
                  <form action={changeRoleAction.bind(null, store.id, slug, m.user_id)} className="row">
                    <select name="role" defaultValue={m.role} aria-label={`Papel de ${m.full_name || m.email}`}>
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </select>
                    <SubmitButton variant="ghost">Salvar</SubmitButton>
                  </form>
                  <form action={removeMemberAction.bind(null, store.id, slug, m.user_id)}>
                    <SubmitButton variant="danger">{m.user_id === user.id ? 'Sair' : 'Remover'}</SubmitButton>
                  </form>
                </div>
              ) : (
                <span className="badge">{ROLE_LABEL[m.role]}</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {manage && (
        <div className="card">
          <h2>Adicionar pessoa</h2>
          <p className="muted small">A pessoa precisa ter criado uma conta no Hyperion com este e-mail.</p>
          <form action={addMemberAction.bind(null, store.id, slug)} className="stack">
            <Field label="E-mail" name="email" type="email" required />
            <label className="field">
              <span className="field-label">Papel</span>
              <select name="role" defaultValue="attendant">
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </label>
            <SubmitButton pendingText="Adicionando…">Adicionar</SubmitButton>
          </form>
        </div>
      )}
    </div>
  )
}
