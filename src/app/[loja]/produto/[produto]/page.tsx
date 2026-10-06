import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { STOCK_BADGE, discountPercent, sortSizes } from '@/lib/catalog'
import { publicUrl } from '@/lib/images'
import { customerMessage, productUrl } from '@/lib/interest'
import { formatBRL } from '@/lib/money'
import { getCatalogProduct } from '@/lib/publicProduct'
import { getSupabaseEnv, siteUrl } from '@/lib/supabase/env'
import { instagramUrl, whatsappUrl } from '@/lib/storeSettings'

type Props = { params: Promise<{ loja: string; produto: string }>; searchParams: Promise<{ aviso?: string }> }

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

export default async function ProductPage({ params, searchParams }: Props) {
  const [{ loja, produto }, sp] = await Promise.all([params, searchParams])
  const page = await getCatalogProduct(loja, produto)
  if (!page) notFound()
  const { store, product: p, images, collections } = page
  const supabaseUrl = getSupabaseEnv()?.url ?? ''
  const link = productUrl(siteUrl(), store.slug, p.slug)
  const off = discountPercent(p.price, p.promo_price)
  const badge = STOCK_BADGE[p.stock_label]
  const buyable = p.stock_label === 'available' || p.stock_label === 'low'
  const interestHref = store.whatsapp ? whatsappUrl(store.whatsapp, customerMessage(p.stock_label, p.name, link, p.promo_price ?? p.price)) : null

  return (
    <div className="shop">
      <nav className="crumbs" aria-label="Você está em">
        <Link href={`/${store.slug}`} className="link">{store.name}</Link> › <span>{p.name}</span>
      </nav>

      <div className="pp-grid">
        <div className="pp-gallery" role="group" aria-label={`Fotos de ${p.name}`}>
          {images.length === 0 ? (
            <div className="pp-photo pp-photo-empty" aria-hidden="true">{p.name.charAt(0)}</div>
          ) : images.map((img, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={img.path} className="pp-photo" src={publicUrl(supabaseUrl, img.path)} alt={img.alt || `${p.name} — foto ${i + 1}`}
              width={960} height={1280} loading={i === 0 ? 'eager' : 'lazy'} fetchPriority={i === 0 ? 'high' : 'auto'} decoding="async" />
          ))}
        </div>

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

          {p.color && <p className="muted small">Cor: <strong>{p.color}</strong></p>}
          {p.sizes.length > 0 && (
            <div>
              <p className="field-label">Tamanhos</p>
              <div className="chip-row">{sortSizes(p.sizes).map((s) => <span key={s} className="size-pill">{s}</span>)}</div>
            </div>
          )}
          {p.description && <p className="pp-desc">{p.description}</p>}
          {collections.length > 0 && (
            <p className="small muted">Em: {collections.map((c, i) => <span key={c.slug}>{i > 0 && ', '}<Link href={`/${store.slug}/colecao/${c.slug}`} className="link">{c.name}</Link></span>)}</p>
          )}

          {buyable && (interestHref
            ? <a href={interestHref} className="btn btn-primary" target="_blank" rel="noopener noreferrer">Tenho interesse — falar no WhatsApp</a>
            : <p className="notice">Esta loja ainda não informou um WhatsApp.{store.instagram_handle && <> Fale com ela pelo <a className="link" href={instagramUrl(store.instagram_handle)} target="_blank" rel="noopener noreferrer">Instagram</a>.</>}</p>)}

          {page.interest_open && (
            <section className="card stack waitlist" aria-labelledby="avise-h">
              <h2 id="avise-h">{p.stock_label === 'sold_out' ? 'Esta peça esgotou' : 'Esta peça está reservada'}</h2>
              <p className="muted small">
                {p.stock_label === 'sold_out'
                  ? 'Quer ser avisada se ela voltar? Fale com a loja pelo WhatsApp: a mensagem já vai pronta.'
                  : 'Se a reserva não se concretizar, a peça pode voltar. Peça para ser avisada pelo WhatsApp: a mensagem já vai pronta.'}
              </p>
              {interestHref ? (
                <form action={`/${store.slug}/produto/${p.slug}/avise-me`} method="post">
                  <button type="submit" className="btn btn-primary">🔔 Avise-me quando chegar</button>
                </form>
              ) : (
                <p className="notice">Esta loja ainda não informou um WhatsApp.{store.instagram_handle && <> Fale com ela pelo <a className="link" href={instagramUrl(store.instagram_handle)} target="_blank" rel="noopener noreferrer">Instagram</a>.</>}</p>
              )}
              {sp.aviso === 'sem-whatsapp' && <p className="notice notice-error" role="alert">Não foi possível abrir o WhatsApp desta loja.</p>}
            </section>
          )}

          <Link href={`/${store.slug}`} className="btn btn-ghost">← Ver mais peças</Link>
        </div>
      </div>

      <footer className="shop-foot"><p className="muted small">Catálogo por <strong>Hyperion Systems</strong></p></footer>
    </div>
  )
}
