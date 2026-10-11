import { slugify } from './slug'

/** Públicos possíveis. Em "Feminino" e "Masculino" o catálogo mostra também as peças unissex. */
export const AUDIENCES = ['feminine', 'masculine', 'unisex', 'kids'] as const
export type Audience = (typeof AUDIENCES)[number]
export const AUDIENCE_LABEL: Record<Audience, string> = { feminine: 'Feminino', masculine: 'Masculino', unisex: 'Unissex', kids: 'Infantil' }
export const isAudience = (v: unknown): v is Audience => typeof v === 'string' && (AUDIENCES as readonly string[]).includes(v)

export const FILTER_KEYS = ['search', 'collection', 'category', 'audience', 'style', 'color', 'size', 'price', 'stock', 'sort'] as const
export type FilterKey = (typeof FILTER_KEYS)[number]

export const FILTER_INFO: Record<FilterKey, { label: string; hint: string }> = {
  search: { label: 'Busca por texto', hint: 'Campo "Buscar peças" no topo.' },
  collection: { label: 'Coleções', hint: 'Atalhos de coleção (Novidades, Verão…).' },
  category: { label: 'Tipo de peça (categorias)', hint: 'Blusas, calças, vestidos, acessórios…' },
  audience: { label: 'Público (feminino, masculino…)', hint: 'Deixe desligado se a loja vende para um público só.' },
  style: { label: 'Estilo', hint: 'Casual, festa, trabalho… você escolhe a lista abaixo.' },
  color: { label: 'Cor', hint: 'Lista as cores das peças disponíveis.' },
  size: { label: 'Tamanho', hint: 'Lista os tamanhos das peças disponíveis.' },
  price: { label: 'Faixa de preço', hint: 'Preço mínimo e máximo.' },
  stock: { label: 'Só com estoque', hint: 'Esconde o que está esgotado.' },
  sort: { label: 'Ordenação', hint: 'Mais novos, menor preço, maior preço, nome.' },
}

export type CatalogFilters = Record<FilterKey, boolean> & { audiences: Audience[]; styles: string[] }

export const MAX_STYLES = 12
export const MAX_PRODUCT_STYLES = 8
export const STYLE_MAX_LEN = 30
export const DEFAULT_STYLES = ['Casual', 'Festa', 'Trabalho', 'Praia', 'Esporte']

/** Igual ao padrão da coluna stores.catalog_filters: loja feminina, sem o filtro de público. */
export const DEFAULT_FILTERS: CatalogFilters = {
  search: true, collection: true, category: true, audience: false, style: false, color: true, size: true, price: true, stock: true, sort: true,
  audiences: ['feminine'], styles: DEFAULT_STYLES,
}

/** Atalhos de configuração para o dono começar de um ponto sensato. */
export const FILTER_PRESETS: { key: string; label: string; apply: Partial<CatalogFilters> }[] = [
  { key: 'feminine', label: 'Loja só feminina', apply: { audience: false, audiences: ['feminine'] } },
  { key: 'masculine', label: 'Loja só masculina', apply: { audience: false, audiences: ['masculine'] } },
  { key: 'unisex', label: 'Loja unissex / multipúblico', apply: { audience: true, audiences: ['feminine', 'masculine', 'unisex'] } },
]

export function cleanStyles(list: unknown): string[] {
  if (!Array.isArray(list)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of list) {
    const t = typeof s === 'string' ? s.replace(/[\u0000-\u001f<>"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, STYLE_MAX_LEN) : ''
    if (t && !seen.has(t.toLowerCase())) { seen.add(t.toLowerCase()); out.push(t) }
  }
  return out.slice(0, MAX_STYLES)
}

/** Lê o JSON vindo do banco com segurança: o que faltar ou vier errado volta ao padrão. */
export function normalizeFilters(raw: unknown): CatalogFilters {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const out = { ...DEFAULT_FILTERS } as CatalogFilters
  for (const k of FILTER_KEYS) if (typeof r[k] === 'boolean') out[k] = r[k] as boolean
  const aud = Array.isArray(r.audiences) ? AUDIENCES.filter((a) => (r.audiences as unknown[]).includes(a)) : []
  out.audiences = aud.length ? aud : DEFAULT_FILTERS.audiences
  out.styles = Array.isArray(r.styles) ? cleanStyles(r.styles) : DEFAULT_STYLES
  return out
}

/** Formulário "Filtros do catálogo" → configuração validada (ou a mensagem de erro). */
export function readCatalogFilters(fd: FormData): { ok: true; filters: CatalogFilters } | { ok: false; error: string } {
  const filters = { ...DEFAULT_FILTERS } as CatalogFilters
  for (const k of FILTER_KEYS) filters[k] = fd.get(`f_${k}`) === 'on'
  const picked = new Set(fd.getAll('audiences').map(String))
  filters.audiences = AUDIENCES.filter((a) => picked.has(a))
  if (!filters.audiences.length) return { ok: false, error: 'Marque pelo menos um público (por exemplo, Feminino).' }
  const rawStyles = String(fd.get('styles') ?? '').split(/[,\n;]/)
  if (rawStyles.some((s) => s.trim().length > STYLE_MAX_LEN)) return { ok: false, error: `Cada estilo pode ter até ${STYLE_MAX_LEN} letras.` }
  filters.styles = cleanStyles(rawStyles)
  if (rawStyles.filter((s) => s.trim()).length > MAX_STYLES) return { ok: false, error: `No máximo ${MAX_STYLES} estilos.` }
  return { ok: true, filters }
}

/** Tipos de peça sugeridos por tipo de loja (viram categorias; só as que ainda não existem). */
export const SUGGESTED_CATEGORIES: { key: string; label: string; names: string[] }[] = [
  { key: 'feminine', label: 'Moda feminina', names: ['Blusas', 'Camisas', 'Vestidos', 'Saias', 'Calças', 'Shorts', 'Macacões', 'Conjuntos', 'Casacos e jaquetas', 'Moda praia', 'Acessórios', 'Bolsas', 'Calçados'] },
  { key: 'masculine', label: 'Moda masculina', names: ['Camisetas', 'Camisas', 'Polos', 'Calças', 'Bermudas', 'Jaquetas e casacos', 'Moletons', 'Moda praia', 'Acessórios', 'Calçados'] },
  { key: 'unisex', label: 'Unissex / multimarca', names: ['Camisetas', 'Blusas', 'Camisas', 'Calças', 'Bermudas', 'Vestidos', 'Casacos e jaquetas', 'Moletons', 'Acessórios', 'Calçados'] },
]

export function suggestedCategoryItems(key: string): { name: string; slug: string }[] {
  const preset = SUGGESTED_CATEGORIES.find((p) => p.key === key)
  return (preset?.names ?? []).map((name) => ({ name, slug: slugify(name) })).filter((i) => i.slug)
}
