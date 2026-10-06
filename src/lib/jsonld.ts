import type { StockLabel } from './catalog'

/** JSON seguro para dentro de <script>: "<" vira \u003c, então nenhum texto da loja consegue fechar a tag. */
export function safeJson(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
}

const AVAILABILITY: Record<StockLabel, string> = {
  available: 'https://schema.org/InStock',
  low: 'https://schema.org/LimitedAvailability',
  reserved: 'https://schema.org/OutOfStock',
  sold_out: 'https://schema.org/OutOfStock',
}

export function productJsonLd(a: {
  storeName: string; name: string; description: string | null; url: string; images: string[]; color: string | null
  price: number; label: StockLabel
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: a.name,
    url: a.url,
    ...(a.images.length ? { image: a.images } : {}),
    ...(a.description ? { description: a.description } : {}),
    ...(a.color ? { color: a.color } : {}),
    brand: { '@type': 'Brand', name: a.storeName },
    offers: {
      '@type': 'Offer', url: a.url, priceCurrency: 'BRL', price: a.price.toFixed(2),
      availability: AVAILABILITY[a.label], seller: { '@type': 'Organization', name: a.storeName },
    },
  }
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: it.url })),
  }
}
