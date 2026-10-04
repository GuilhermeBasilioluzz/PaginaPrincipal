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
  const { data, error } = await supabase.rpc('store_dashboard', { p_store: membership.store.id })

  if (error) {
    return <p className="notice notice-error" role="alert">Não foi possível carregar o painel agora. Atualize a página.</p>
  }
  return <DashboardView data={parseDashboard(data)} canEdit={can(membership.role, 'edit_products') && membership.store.is_active} />
}
