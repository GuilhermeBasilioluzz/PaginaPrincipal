import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getMemberships } from '@/lib/session'
import { ROLE_LABEL } from '@/lib/permissions'

export const metadata = { title: 'Minhas lojas' }

export default async function StoresPage() {
  const memberships = await getMemberships()
  if (memberships.length === 0) redirect('/app/nova-loja')
  if (memberships.length === 1) redirect(`/app/${memberships[0].store.slug}`)

  return (
    <>
      <h1>Minhas lojas</h1>
      <ul className="list">
        {memberships.map(({ store, role }) => (
          <li key={store.id}>
            <Link href={`/app/${store.slug}`} className="list-item">
              <strong>{store.name}</strong>
              <span className="muted small">{ROLE_LABEL[role]} · /{store.slug}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/app/nova-loja" className="btn btn-ghost">Criar outra loja</Link>
    </>
  )
}
