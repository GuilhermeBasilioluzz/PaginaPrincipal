import { z } from 'zod'
import { parseBRL } from './money'
import { parseSizes, MAX_SIZES } from './sizes'
import { slugify } from './slug'
import { AUDIENCES, MAX_PRODUCT_STYLES, cleanStyles } from './catalogFilters'

export const EDITABLE_STATUS = ['available', 'reserved', 'sold', 'unavailable'] as const
export const PAGE_SIZE = 20

const blank = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

/** Dados do formulário de produto (texto cru) → payload validado para a função save_product(). */
export const productFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Informe o nome da peça.').max(120, 'O nome é longo demais (máximo 120).'),
    price: z.string().transform((v, ctx) => {
      const n = parseBRL(v)
      if (n === null) ctx.addIssue({ code: 'custom', message: 'Informe um preço válido, como 189,90.' })
      return n ?? 0
    }),
    promo: z.string().optional().transform((v, ctx) => {
      if (blank(v) === '') return null
      const n = parseBRL(v!)
      if (n === null) ctx.addIssue({ code: 'custom', message: 'O preço promocional não é válido.' })
      return n
    }),
    quantity: z.string().transform((v, ctx) => {
      const t = v.trim()
      if (!/^\d{1,5}$/.test(t)) {
        ctx.addIssue({ code: 'custom', message: 'Informe a quantidade em estoque (número inteiro, 0 ou mais).' })
        return 0
      }
      return Number(t)
    }),
    color: z.string().trim().max(40, 'A cor é longa demais.').optional(),
    sku: z.string().trim().max(40, 'O código é longo demais (máximo 40).').optional(),
    description: z.string().trim().max(2000, 'A descrição é longa demais (máximo 2000).').optional(),
    video: z.string().trim().max(300).optional().refine((v) => !v || /^https?:\/\/\S+$/i.test(v), 'O link do vídeo precisa começar com http:// ou https://.'),
    status: z.enum(EDITABLE_STATUS).optional(),
    category: z.string().optional().refine((v) => !v || /^[0-9a-f-]{36}$/i.test(v), 'Categoria inválida.'),
    featured: z.boolean(),
    audience: z.enum(AUDIENCES).optional(),
    styles: z.array(z.string()).max(MAX_PRODUCT_STYLES, `No máximo ${MAX_PRODUCT_STYLES} estilos por peça.`),
    sizes: z.array(z.string().trim().min(1).max(12, 'Cada tamanho pode ter até 12 caracteres.')).max(MAX_SIZES, `No máximo ${MAX_SIZES} tamanhos.`),
  })
  .superRefine((v, ctx) => {
    if (v.promo !== null && v.promo !== undefined && v.price > 0 && v.promo >= v.price) {
      ctx.addIssue({ code: 'custom', path: ['promo'], message: 'O preço promocional precisa ser menor que o preço.' })
    }
  })

export type ProductPayload = {
  name: string; slug_base: string; description: string; price: number; promo_price: number | null
  category_id: string; color: string; sizes: string[]; sku: string; video_url: string
  status?: string; featured: boolean; quantity: number; audience?: string; styles?: string[]
}

/** Lê o FormData do formulário e devolve o payload ou a primeira mensagem de erro. */
export function readProductForm(fd: FormData, opts: { keepStatus?: boolean } = {}): { ok: true; payload: ProductPayload } | { ok: false; error: string } {
  const text = (k: string) => String(fd.get(k) ?? '')
  const parsed = productFormSchema.safeParse({
    name: text('name'),
    price: text('price'),
    promo: text('promo'),
    quantity: text('quantity'),
    color: text('color'),
    sku: text('sku'),
    description: text('description'),
    video: text('video'),
    status: opts.keepStatus ? undefined : text('status') || undefined,
    category: text('category'),
    featured: fd.get('featured') === 'on',
    audience: text('audience') || undefined,
    styles: cleanStyles(fd.getAll('styles').map(String)),
    sizes: parseSizes(fd.getAll('sizes').map(String), text('sizesExtra')),
  })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  const d = parsed.data
  return {
    ok: true,
    payload: {
      name: d.name,
      slug_base: slugify(d.name) || 'produto',
      description: d.description ?? '',
      price: d.price,
      promo_price: d.promo ?? null,
      category_id: d.category ?? '',
      color: d.color ?? '',
      sizes: d.sizes,
      sku: d.sku ?? '',
      video_url: d.video ?? '',
      ...(d.status ? { status: d.status } : {}),
      featured: d.featured,
      quantity: d.quantity,
      // sem o campo no formulário (filtro desligado), o banco mantém o valor atual
      ...(d.audience ? { audience: d.audience } : {}),
      ...(fd.has('styles_present') ? { styles: d.styles } : {}),
    },
  }
}

/** Texto de busca seguro para o filtro do PostgREST (tira os caracteres que mudariam o filtro). */
export function searchTerm(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw.replace(/[,()*%\\"':;]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)
}

export const LIST_FILTERS = ['all', 'available', 'reserved', 'sold', 'unavailable', 'archived'] as const
export type ListFilter = (typeof LIST_FILTERS)[number]

export function listFilter(raw: unknown): ListFilter {
  return (LIST_FILTERS as readonly string[]).includes(raw as string) ? (raw as ListFilter) : 'all'
}

export function pageNumber(raw: unknown): number {
  const n = Number.parseInt(String(raw ?? '1'), 10)
  return Number.isFinite(n) && n >= 1 && n <= 10_000 ? n : 1
}

export const COLOR_SUGGESTIONS = ['Preto', 'Branco', 'Off-white', 'Bege', 'Nude', 'Rosa', 'Vermelho', 'Terracota', 'Vinho', 'Verde', 'Azul', 'Marinho', 'Amarelo', 'Cinza', 'Marrom', 'Estampado']
