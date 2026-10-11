import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMembership, requireUser } from '@/lib/session'
import { PERMISSION_TABLE, ROLE_LABEL, ROLES, can } from '@/lib/permissions'
import { InviteForm } from '@/components/InviteForm'
import { INVITE_STATUS_LABEL, type InviteRow } from '@/lib/invites'
import { timeAgo } from '@/lib/dashboard'
import { revokeInviteAction } from './invite-actions'
import type { TeamMember } from '@/lib/types'
import { SubmitButton, Field } from '@/components/ui'
import { addMemberAction, changeRoleAction, removeMemberAction } from '../../actions'

export const metadata = { title: 'Equipe' }

const FLASH: Record<string, string> = {
  added: 'Membro adicionado.',
  role: 'Papel atualizado.',
  removed: 'Membro removido.',
  revoked: 'Convite cancelado: o link deixou de valer.',
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
  const canInvite = can(role, 'invite') && store.is_active
  const invites = canInvite ? (((await supabase.rpc('store_invites_list', { p_store: store.id })).data ?? []) as InviteRow[]) : []
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

      {canInvite && (
        <div className="card stack">
          <h2>Convidar por link</h2>
          <p className="muted small">
            Crie um link e mande por WhatsApp. A pessoa entra (ou cria a conta) e já cai na loja com o papel escolhido.
            O link vale por um prazo e por um número de pessoas, e você pode cancelar quando quiser.
          </p>
          <InviteForm storeId={store.id} slug={slug} storeName={store.name} />
          {invites.length > 0 && (
            <>
              <h3 style={{ margin: '0.5rem 0 0', fontSize: '1rem' }}>Convites criados</h3>
              <ul className="list">
                {invites.map((i) => (
                  <li key={i.id} className="member">
                    <div>
                      <strong>{i.label || ROLE_LABEL[i.role]}</strong>{' '}
                      <span className="muted small">como {ROLE_LABEL[i.role].toLowerCase()} · {i.uses}/{i.max_uses} uso(s) · criado {timeAgo(i.created_at)}{i.created_by_name ? ` por ${i.created_by_name}` : ''}</span>
                    </div>
                    <div className="row">
                      <span className={`badge${i.status === 'active' ? ' badge-auto' : ''}`}>{INVITE_STATUS_LABEL[i.status]}</span>
                      {i.status === 'active' && (
                        <form action={revokeInviteAction.bind(null, slug, i.id)}><SubmitButton variant="danger">Cancelar</SubmitButton></form>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

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

      <div className="card stack">
        <h2>Quem pode o quê</h2>
        <div className="table-wrap">
          <table className="perm-table">
            <thead><tr><th scope="col">Ação</th><th scope="col">{ROLE_LABEL.owner}</th><th scope="col">{ROLE_LABEL.manager}</th><th scope="col">{ROLE_LABEL.attendant}</th></tr></thead>
            <tbody>
              {PERMISSION_TABLE.map((r) => (
                <tr key={r.capability}>
                  <th scope="row">{r.label}</th>
                  {[r.owner, r.manager, r.attendant].map((ok, i) => <td key={i} aria-label={ok ? 'pode' : 'não pode'}>{ok ? '✓' : '—'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">Todas as ações ficam registradas em <Link href={`/app/${slug}/atividades`} className="link">Atividades</Link>, com quem fez e quando.</p>
      </div>
    </div>
  )
}
