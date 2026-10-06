import Link from 'next/link'
import { STOCK_BADGE, discountPercent, type CatalogProduct } from '@/lib/catalog'
import { publicUrl, thumbPath } from '@/lib/images'
import { formatBRL } from '@/lib/money'

export function ProductCard({ product: p, storeSlug, supabaseUrl, priority }: {
  product: CatalogProduct; storeSlug: string; supabaseUrl: string; priority: boolean
}) {
  const badge = STOCK_BADGE[p.stock_label]
  const off = discountPercent(p.price, p.promo_price)
  const soldOut = p.stock_label === 'sold_out'
  return (
    <li className={`shop-card${soldOut ? ' shop-card-out' : ''}`}>
      <Link href={`/${storeSlug}/produto/${p.slug}`} className="shop-card-link">
        <div className="shop-card-media">
          {p.cover_path
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={publicUrl(supabaseUrl, thumbPath(p.cover_path))} alt={p.name} width={480} height={640}
                loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} decoding="async" />
            : <span className="shop-card-empty" aria-hidden="true">{p.name.charAt(0)}</span>}
          {badge && <span className={`shop-badge shop-badge-${p.stock_label}`}>{badge}</span>}
          {off !== null && !soldOut && <span className="shop-off">−{off}%</span>}
        </div>
        <div className="shop-card-body">
          <h3>{p.name}</h3>
          <p className="shop-price">
            {p.promo_price !== null && p.promo_price < p.price
              ? <><s>{formatBRL(p.price)}</s> <strong>{formatBRL(p.promo_price)}</strong></>
              : <strong>{formatBRL(p.price)}</strong>}
          </p>
          {p.sizes.length > 0 && <p className="shop-sizes">{p.sizes.slice(0, 6).join(' · ')}</p>}
        </div>
      </Link>
    </li>
  )
}
