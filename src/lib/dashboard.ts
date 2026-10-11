import { z } from 'zod'

export const STATUS_LABEL = {
  available: 'Disponível',
  reserved: 'Reservado',
  sold: 'Vendido',
  unavailable: 'Indisponível',
  archived: 'Arquivado',
} as const
export type ProductStatus = keyof typeof STATUS_LABEL

const n = z.coerce.number().int().nonnegative().catch(0)

const schema = z.object({
  products: z.object({
    total: n, available: n, reserved: n, sold: n, unavailable: n, archived: n, featured: n,
  }).catch({ total: 0, available: 0, reserved: 0, sold: 0, unavailable: 0, archived: 0, featured: 0 }),
  collections: n,
  categories: n,
  team: n,
  reservations: n,
  interests: n,
  interest_clicks: n,
  stock: z.object({ low: n, out: n }).catch({ low: 0, out: 0 }),
  recent: z.array(z.object({
    id: z.coerce.number().catch(0),
    created_at: z.string(),
    action: z.string().catch(''),
    entity_type: z.string().catch(''),
    entity_name: z.string().nullable().catch(null),
    details: z.record(z.string(), z.unknown()).catch({}),
    actor: z.string().nullable().catch(null),
  })).catch([]),
})

export type Dashboard = z.infer<typeof schema>

/** Resposta de store_dashboard() → dados seguros para a tela (valores ausentes ou inválidos viram zero). */
export function parseDashboard(raw: unknown): Dashboard {
  return schema.parse(typeof raw === 'object' && raw !== null ? raw : {})
}

export const isEmptyStore = (d: Dashboard) => d.products.total === 0 && d.products.archived === 0

export type Segment = { status: Exclude<ProductStatus, 'archived'>; label: string; count: number; percent: number }

/** Fatias da barra de situação do catálogo (arquivados ficam de fora). Percentuais somam 100 quando há produtos. */
export function statusSegments(p: Dashboard['products']): Segment[] {
  const parts = (['available', 'reserved', 'sold', 'unavailable'] as const).map((status) => ({
    status, label: STATUS_LABEL[status], count: p[status],
  }))
  const total = parts.reduce((sum, s) => sum + s.count, 0)
  if (total === 0) return parts.map((s) => ({ ...s, percent: 0 }))

  const raw = parts.map((s) => (s.count / total) * 100)
  const floors = raw.map(Math.floor)
  let rest = 100 - floors.reduce((a, b) => a + b, 0)
  // distribui o que sobrou às maiores partes decimais
  const order = raw.map((v, i) => ({ i, frac: v - floors[i] })).sort((a, b) => b.frac - a.frac)
  for (const { i } of order) { if (rest <= 0) break; floors[i]++; rest-- }
  return parts.map((s, i) => ({ ...s, percent: floors[i] }))
}

/** "agora", "há 5 min", "há 3 h", "ontem", "há 4 dias" ou a data. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso)
  const seconds = Math.round((now.getTime() - then.getTime()) / 1000)
  if (Number.isNaN(seconds)) return ''
  if (seconds < 60) return 'agora'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours} h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'ontem'
  if (days < 7) return `há ${days} dias`
  return then.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
