import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ProductForm, type ProductFormValues } from '@/components/ProductForm'
import { ConfirmButton } from '@/components/ConfirmButton'
import { SubmitButton } from '@/components/ui'
import { can } from '@/lib/permissions'
import { formatInput } from '@/lib/money'
import { splitSizes } from '@/lib/sizes'
import { getMembership } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseEnv } from '@/lib/supabase/env'
import { PhotoManager, type PhotoItem } from '@/components/PhotoManager'
import { archiveProductAction, deleteProductAction, duplicateProductAction, restoreProductAction } from '../actions'

export const metadata = { title: 'Editar produto' }

const FLASH: Record<string, string> = { created: 'Produto criado! Agora adicione as fotos abaixo.', duplicated: 'Cópia criada. Ela está como indisponível: revise os dados, informe o estoque e publique.' }

export default async function EditProductPage({ params, searchParams }: {
  params: Promise<{ store: string; id: string }>
  searchParams: Promise<{ ok?: string }>
}) {
  const [{ store: slug, id }, { ok }] = await Promise.all([params, searchParams])
  const membership = await getMembership(slug)
  if (!membership || !/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const { store, role } = membership

  const supabase = await createClient()
  const { data: p } = await supabase.from('products').select('*').eq('id', id).eq('store_id', store.id).maybeSingle()
  if (!p) notFound()
  const [{ data: inv }, { data: categories }, { data: photos }] = await Promise.all([
    supabase.from('inventory').select('quantity').eq('product_id', id).maybeSingle(),
    supabase.from('categories').select('id, name').eq('store_id', store.id).order('position').order('name'),
    supabase.from('product_images').select('id, path, kind, alt').eq('product_id', id).order('position'),
  ])

  const { checked, extra } = splitSizes(p.sizes ?? [])
  const initial: ProductFormValues = {
    name: p.name, price: formatInput(p.price), promo: formatInput(p.promo_price), quantity: String(inv?.quantity ?? 0),
    color: p.color ?? '', sku: p.sku ?? '', description: p.description ?? '', video: p.video_url ?? '',
    status: p.status === 'archived' ? 'unavailable' : p.status, category: p.category_id ?? '', featured: p.is_featured,
    sizes: checked, sizesExtra: extra,
  }
  const editable = can(role, 'edit_products') && store.is_active
  const archived = p.status === 'archived'

  return (
    <div className="narrow stack-lg">
      {ok && FLASH[ok] && <p className="notice notice-ok" role="status">{FLASH[ok]}</p>}
      <div className="card">
        <Link href={`/app/${slug}/produtos`} className="link small">← Produtos</Link>
        <h1>{p.name}</h1>
        <p className="muted small">Endereço do produto: <code>/{slug}/produto/{p.slug}</code></p>
        {archived && <p className="notice notice-error">Este produto está arquivado e fora do catálogo.</p>}
        {editable
          ? <ProductForm storeId={store.id} slug={slug} productId={id} initial={initial} categories={categories ?? []} archived={archived} />
          : <p className="notice">Você só pode consultar este produto.</p>}
      </div>

      <div className="card">
        <PhotoManager storeId={store.id} slug={slug} productId={id} productName={p.name} supabaseUrl={getSupabaseEnv()?.url ?? ''}
          photos={(photos ?? []) as PhotoItem[]} canEdit={editable} />
      </div>

      {editable && (
        <div className="card stack">
          <h2>Outras ações</h2>
          <div className="row">
            <form action={duplicateProductAction.bind(null, store.id, slug, id)}><SubmitButton variant="ghost">Duplicar produto</SubmitButton></form>
            {archived
              ? <form action={restoreProductAction.bind(null, slug, id)}><SubmitButton variant="ghost">Restaurar</SubmitButton></form>
              : <form action={archiveProductAction.bind(null, slug, id)}><SubmitButton variant="ghost">Arquivar</SubmitButton></form>}
            {can(role, 'delete_products') && (
              <form action={deleteProductAction.bind(null, slug, id)}>
                <ConfirmButton message="Excluir este produto de vez? Isso apaga também estoque e fotos e não pode ser desfeito. Para só tirar do catálogo, use Arquivar.">Excluir</ConfirmButton>
              </form>
            )}
          </div>
          <p className="muted small">Arquivar guarda o histórico e tira a peça do catálogo. Só donos e gerentes podem excluir.</p>
        </div>
      )}
    </div>
  )
}
