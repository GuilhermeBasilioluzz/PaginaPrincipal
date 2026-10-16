import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ShareCard } from '@/components/ShareCard'
import { getMembership } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { siteUrl } from '@/lib/supabase/env'
import { shareTargetParam, shareUrl, type ShareTarget } from '@/lib/qr'

export const metadata = { title: 'Compartilhar' }
export const dynamic = 'force-dynamic'

export default async function SharePage({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params
  const membership = await getMembership(slug)
  if (!membership) notFound()
  const { store } = membership
  const site = siteUrl()

  const supabase = await createClient()
  const [{ data: cols }, { data: prods }, { data: s }] = await Promise.all([
    supabase.from('collections').select('name, slug, kind').eq('store_id', store.id).eq('is_published', true).order('kind', { ascending: false }).order('name'),
    supabase.from('products').select('name, slug').eq('store_id', store.id).in('status', ['available', 'reserved']).order('published_at', { ascending: false }).limit(12),
    supabase.from('stores').select('name, catalog_enabled').eq('id', store.id).maybeSingle(),
  ])
  const live = !!s?.catalog_enabled && store.is_active
  const card = (title: string, t: ShareTarget, text: string) => {
    const param = encodeURIComponent(shareTargetParam(t))
    return (
      <ShareCard key={param} title={title} url={shareUrl(site, store.slug, t)} text={text}
        qrSrc={`/${store.slug}/qr?para=${param}`} posterHref={`/app/${slug}/compartilhar/cartaz?para=${param}`} />
    )
  }

  return (
    <div className="stack-lg">
      <div className="card stack">
        <h2>Compartilhar</h2>
        <p className="muted small">Links e QR Codes para a bio do Instagram, os Stories, o balcão e o WhatsApp. A cliente abre direto no celular, sem baixar nada.</p>
        {!live && <p className="notice notice-error" role="alert">O catálogo está desligado: quem abrir o link vê uma página vazia. Ligue em <Link className="link" href={`/app/${slug}/configuracoes`}>Configurações</Link>.</p>}
        <ul className="small muted">
          <li><strong>Bio do Instagram:</strong> cole o link da loja no campo “Site”.</li>
          <li><strong>Story:</strong> use o adesivo de Link com o endereço da coleção ou da peça.</li>
          <li><strong>Balcão:</strong> imprima o cartaz com o QR Code.</li>
        </ul>
      </div>

      {card(`Loja ${s?.name ?? store.name}`, { kind: 'loja' }, `Conheça o catálogo da ${s?.name ?? store.name}:`)}

      <section className="stack" aria-labelledby="col-h">
        <h2 id="col-h">Coleções</h2>
        {(cols ?? []).length === 0
          ? <div className="card empty"><p className="muted">Nenhuma coleção publicada ainda.</p></div>
          : (cols ?? []).map((c) => card(`Coleção ${c.name}`, { kind: 'colecao', slug: c.slug }, `Olha a coleção ${c.name} da ${s?.name ?? store.name}:`))}
      </section>

      <section className="stack" aria-labelledby="pc-h">
        <h2 id="pc-h">Peças mais recentes</h2>
        <p className="muted small">Só peças disponíveis ou reservadas. Para outra peça, use “Compartilhar” na página dela no catálogo.</p>
        {(prods ?? []).length === 0
          ? <div className="card empty"><p className="muted">Nenhuma peça no catálogo ainda.</p></div>
          : (prods ?? []).map((p) => card(p.name, { kind: 'produto', slug: p.slug }, `Olha essa peça da ${s?.name ?? store.name}: ${p.name}`))}
      </section>
    </div>
  )
}
