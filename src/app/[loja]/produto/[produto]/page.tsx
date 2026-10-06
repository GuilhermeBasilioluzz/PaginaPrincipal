import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ProductCard } from '@/components/catalog/ProductCard'
import { ProductActions } from '@/components/catalog/ProductActions'
import { ProductGallery } from '@/components/catalog/ProductGallery'
import { ShareBar } from '@/components/catalog/ShareBar'
import { STOCK_BADGE, discountPercent } from '@/lib/catalog'
import { publicUrl, thumbPath } from '@/lib/images'
import { productUrl } from '@/lib/interest'
import { breadcrumbJsonLd, productJsonLd, safeJson } from '@/lib/jsonld'
import { formatBRL } from '@/lib/money'
import { getCatalogProduct, getCatalogRelated } from '@/lib/publicProduct'
import { shareText } from '@/lib/share'
import { getSupabaseEnv, siteUrl } from '@/lib/supabase/env'

type Props = { params: Promise<{ loja: string; produto: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { loja, produto } = await params
  const page = await getCatalogProduct(loja, produto)
  if (!page) return { title: 'Peça não encontrada', robots: { index: false } }
  const { product: p, store } = page
  const price = p.promo_price !== null && p.promo_price < p.price ? p.promo_price : p.price
  const title = `${p.name} — ${store.name}`
  const description = (p.description || `${p.name} por ${formatBRL(price)} na ${store.name}.`).slice(0, 160)
  const image = page.images[0] ? publicUrl(getSupabaseEnv()?.url ?? '', page.images[0].path) : undefined
  const url = `/${store.slug}/produto/${p.slug}`
  return {
    title: { absolute: title }, description, alternates: { canonical: url },
    openGraph: { title, description, url, siteName: store.name, type: 'website', locale: 'pt_BR', ...(image ? { images: [{ url: image }] } : {}) },
    twitter: { card: image ? 'summary_large_image' : 'summary', title, description },
    other: { 'product:price:amount': String(price), 'product:price:currency': 'BRL' },
  }
}

export default async function ProductPage({ params }: Props) {
  const { loja, produto } = await params
  const [page, related] = await Promise.all([getCatalogProduct(loja, produto), getCatalogRelated(loja, produto)])
  if (!page) notFound()
  const { store, product: p, images, collections, category } = page
  const supabaseUrl = getSupabaseEnv()?.url ?? ''
  const site = siteUrl()
  const link = productUrl(site, store.slug, p.slug)
  const price = p.promo_price !== null && p.promo_price < p.price ? p.promo_price : p.price
  const off = discountPercent(p.price, p.promo_price)
  const badge = STOCK_BADGE[p.stock_label]

  const gallery = images.map((img, i) => ({ src: publicUrl(supabaseUrl, img.path), thumb: publicUrl(supabaseUrl, thumbPath(img.path)), alt: img.alt || `${p.name} — foto ${i + 1}` }))
  const crumbs = [
    { name: store.name, url: `${site}/${store.slug}` },
    ...(category?.parent_slug ? [{ name: category.parent_name!, url: `${site}/${store.slug}?categoria=${category.parent_slug}` }] : []),
    ...(category ? [{ name: category.name, url: `${site}/${store.slug}?categoria=${category.slug}` }] : []),
    { name: p.name, url: link },
  ]

  return (
    <div className="shop">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson(productJsonLd({
        storeName: store.name, name: p.name, description: p.description, url: link, images: gallery.map((g) => g.src), color: p.color, price, label: p.stock_label,
      })) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson(breadcrumbJsonLd(crumbs)) }} />

      <nav className="crumbs" aria-label="Você está em">
        <Link href={`/${store.slug}`} className="link">{store.name}</Link>
        {category?.parent_slug && <> › <Link href={`/${store.slug}?categoria=${category.parent_slug}`} className="link">{category.parent_name}</Link></>}
        {category && <> › <Link href={`/${store.slug}?categoria=${category.slug}`} className="link">{category.name}</Link></>}
        {' › '}<span>{p.name}</span>
      </nav>

      <div className="pp-grid">
        <ProductGallery images={gallery} name={p.name} />

        <div className="pp-info stack">
          <div>
            <h1>{p.name}</h1>
            <p className="pp-price">
              {p.promo_price !== null && p.promo_price < p.price
                ? <><s>{formatBRL(p.price)}</s> <strong>{formatBRL(p.promo_price)}</strong>{off !== null && <span className="shop-off pp-off">−{off}%</span>}</>
                : <strong>{formatBRL(p.price)}</strong>}
            </p>
            {badge && <span className={`shop-badge-inline shop-badge-${p.stock_label}`}>{badge}</span>}
          </div>

          {p.color && <p className="muted small" style={{ margin: 0 }}>Cor: <strong>{p.color}</strong></p>}

          <ProductActions storeSlug={store.slug} productSlug={p.slug} name={p.name} price={price} label={p.stock_label} sizes={p.sizes}
            whatsapp={store.whatsapp} instagram={store.instagram_handle} interestOpen={page.interest_open} siteUrl={site} />

          {p.description && <p className="pp-desc">{p.description}</p>}
          {collections.length > 0 && (
            <p className="small muted" style={{ margin: 0 }}>Em: {collections.map((c, i) => <span key={c.slug}>{i > 0 && ', '}<Link href={`/${store.slug}/colecao/${c.slug}`} className="link">{c.name}</Link></span>)}</p>
          )}

          <ShareBar url={link} title={`${p.name} — ${store.name}`} text={shareText(store.name, p.name, price)} />
        </div>
      </div>

      {related.length > 0 && (
        <section className="stack" aria-labelledby="rel-h">
          <h2 id="rel-h" className="eyebrow">Você também pode gostar</h2>
          <ul className="shop-grid">
            {related.map((r) => <ProductCard key={r.id} product={{ ...r, total: related.length }} storeSlug={store.slug} supabaseUrl={supabaseUrl} priority={false} />)}
          </ul>
        </section>
      )}

      <footer className="shop-foot"><p className="muted small">Catálogo por <strong>Hyperion Systems</strong></p></footer>
    </div>
  )
}
