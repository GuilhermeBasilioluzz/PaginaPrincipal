import { parseBRL } from './money'
import { searchTerm } from './products'

export const CATALOG_PAGE_SIZE = 24
export const SORTS = { new: 'Mais novos', price_asc: 'Menor preço', price_desc: 'Maior preço', name: 'Nome (A–Z)' } as const
export type SortKey = keyof typeof SORTS

export type StockLabel = 'available' | 'low' | 'reserved' | 'sold_out'
export const STOCK_BADGE: Record<StockLabel, string | null> = {
  available: null, low: 'Poucas unidades', reserved: 'Reservado', sold_out: 'Esgotado',
}

export type CatalogQuery = {
  q: string; category: string; color: string; size: string
  min: number | null; max: number | null; stock: boolean; sort: SortKey; page: number
}
export const DEFAULT_QUERY: CatalogQuery = { q: '', category: '', color: '', size: '', min: null, max: null, stock: false, sort: 'new', page: 1 }

type Raw = Record<string, string | string[] | undefined>
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''
const clean = (v: string, max: number) => v.replace(/[\u0000-\u001f<>"'`\\]/g, '').trim().slice(0, max)

/** Lê os filtros da URL. Tudo que vier fora do esperado é descartado (a URL é entrada do usuário). */
export function parseCatalogQuery(sp: Raw): CatalogQuery {
  const category = first(sp.categoria).toLowerCase()
  let min = parseBRL(first(sp.min))
  let max = parseBRL(first(sp.max))
  if (min !== null && max !== null && min > max) [min, max] = [max, min]
  const sort = first(sp.ordem)
  const page = Number.parseInt(first(sp.pagina) || '1', 10)
  return {
    q: searchTerm(first(sp.q)),
    category: /^[a-z0-9]+(-[a-z0-9]+)*$/.test(category) && category.length <= 60 ? category : '',
    color: clean(first(sp.cor), 30),
    size: clean(first(sp.tamanho), 12),
    min, max,
    stock: first(sp.estoque) === '1',
    sort: sort in SORTS ? (sort as SortKey) : 'new',
    page: Number.isFinite(page) && page >= 1 && page <= 1000 ? page : 1,
  }
}

const num = (n: number) => String(n).replace('.', ',')

/** Caminho + parâmetros (só os que não são o padrão). `override` troca partes da consulta atual. */
export function catalogHref(path: string, query: CatalogQuery, override: Partial<CatalogQuery> = {}): string {
  const q = { ...query, ...override }
  const u = new URLSearchParams()
  if (q.q) u.set('q', q.q)
  if (q.category) u.set('categoria', q.category)
  if (q.color) u.set('cor', q.color)
  if (q.size) u.set('tamanho', q.size)
  if (q.min !== null) u.set('min', num(q.min))
  if (q.max !== null) u.set('max', num(q.max))
  if (q.stock) u.set('estoque', '1')
  if (q.sort !== 'new') u.set('ordem', q.sort)
  if (q.page > 1) u.set('pagina', String(q.page))
  const s = u.toString()
  return s ? `${path}?${s}` : path
}

export type ActiveFilter = { label: string; href: string }

export function activeFilters(path: string, q: CatalogQuery, categoryName?: string): ActiveFilter[] {
  const out: ActiveFilter[] = []
  const drop = (o: Partial<CatalogQuery>) => catalogHref(path, q, { ...o, page: 1 })
  if (q.q) out.push({ label: `Busca: ${q.q}`, href: drop({ q: '' }) })
  if (q.category) out.push({ label: categoryName ?? q.category, href: drop({ category: '' }) })
  if (q.color) out.push({ label: `Cor: ${q.color}`, href: drop({ color: '' }) })
  if (q.size) out.push({ label: `Tamanho: ${q.size}`, href: drop({ size: '' }) })
  if (q.min !== null || q.max !== null) {
    const label = q.min !== null && q.max !== null ? `R$ ${num(q.min)} a ${num(q.max)}` : q.min !== null ? `A partir de R$ ${num(q.min)}` : `Até R$ ${num(q.max!)}`
    out.push({ label, href: drop({ min: null, max: null }) })
  }
  if (q.stock) out.push({ label: 'Só com estoque', href: drop({ stock: false }) })
  return out
}

const LETTER_ORDER = ['pp', 'p', 'm', 'g', 'gg', 'xg', 'único', 'unico']
/** PP, P, M, G, GG, XG, Único, depois números em ordem, depois o resto. */
export function sortSizes(sizes: string[]): string[] {
  const rank = (s: string) => {
    const l = s.toLowerCase()
    const li = LETTER_ORDER.indexOf(l)
    if (li >= 0) return [0, li, 0] as const
    if (/^\d+$/.test(s)) return [1, Number(s), 0] as const
    return [2, 0, 0] as const
  }
  return [...sizes].sort((a, b) => {
    const [ra, rb] = [rank(a), rank(b)]
    return ra[0] - rb[0] || ra[1] - rb[1] || a.localeCompare(b, 'pt-BR')
  })
}

/** "-21%" quando há promoção de verdade. */
export function discountPercent(price: number, promo: number | null): number | null {
  if (promo === null || promo >= price || price <= 0) return null
  return Math.round((1 - promo / price) * 100)
}

export type CatalogStore = {
  store: {
    id: string; slug: string; name: string; tagline: string | null; description: string | null; whatsapp: string | null
    instagram_handle: string | null; address: string | null; opening_hours: string | null
    logo_path: string | null; banner_path: string | null; accent_color: string | null
  }
  total: number
  categories: { name: string; slug: string; parent_slug: string | null; count: number }[]
  collections: { name: string; slug: string; automatic: boolean; count: number }[]
  colors: string[]; sizes: string[]; price_min: number | null; price_max: number | null
}

export type CatalogProduct = {
  id: string; name: string; slug: string; price: number; promo_price: number | null; color: string | null
  sizes: string[]; is_featured: boolean; published_at: string; stock_label: StockLabel; cover_path: string | null; total: number
}
