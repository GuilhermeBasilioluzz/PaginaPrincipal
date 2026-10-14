import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DashboardView } from '@/components/DashboardView'
import { parseDashboard } from '@/lib/dashboard'
import { can } from '@/lib/permissions'
import { getMembership } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Painel' }

export default async function StoreHome({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params
  const membership = await getMembership(slug)
  if (!membership) notFound()

  const supabase = await createClient()
  const [{ data, error }, { data: pendingStories }] = await Promise.all([
    supabase.rpc('store_dashboard', { p_store: membership.store.id }),
    supabase.rpc('stories_pending_count', { p_store: membership.store.id }),
  ])
  const stories = Number(pendingStories ?? 0)

  if (error) {
    return <p className="notice notice-error" role="alert">Não foi possível carregar o painel agora. Atualize a página.</p>
  }
  return (
    <div className="stack">
      {stories > 0 && (
        <p className="notice" role="status">
          Você tem <strong>{stories}</strong> {stories === 1 ? 'Story' : 'Stories'} para revisar. <Link href={`/app/${slug}/stories`} className="link">Abrir Stories</Link>
        </p>
      )}
      <DashboardView data={parseDashboard(data)} canEdit={can(membership.role, 'edit_products') && membership.store.is_active} newProductHref={`/app/${slug}/produtos/novo`} />
    </div>
  )
}
