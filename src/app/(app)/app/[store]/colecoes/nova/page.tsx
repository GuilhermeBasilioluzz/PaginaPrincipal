import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { CollectionForm, EMPTY_COLLECTION } from '@/components/CollectionForm'
import { can } from '@/lib/permissions'
import { getMembership } from '@/lib/session'
import { saveCollectionAction } from '../actions'

export const metadata = { title: 'Nova coleção' }

export default async function NewCollectionPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params
  const membership = await getMembership(slug)
  if (!membership) notFound()
  if (!can(membership.role, 'manage_structure') || !membership.store.is_active) redirect(`/app/${slug}/colecoes?erro=forbidden`)

  return (
    <div className="card narrow">
      <Link href={`/app/${slug}/colecoes`} className="link small">← Coleções</Link>
      <h1>Nova coleção</h1>
      <CollectionForm action={saveCollectionAction.bind(null, membership.store.id, slug, null)} initial={EMPTY_COLLECTION}
        cancelHref={`/app/${slug}/colecoes`} submitLabel="Criar coleção" />
    </div>
  )
}
