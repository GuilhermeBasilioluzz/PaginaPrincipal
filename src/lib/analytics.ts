// Análises do catálogo: só contadores anônimos (sem IP, cookie ou identificador de visitante).

export const EVENT_KINDS = ['store_view', 'collection_view', 'product_view', 'whatsapp_click', 'share_click'] as const
export type EventKind = (typeof EVENT_KINDS)[number]
export const isEventKind = (v: unknown): v is EventKind => typeof v === 'string' && (EVENT_KINDS as readonly string[]).includes(v)

export const SOURCES = ['direto', 'qr', 'bio', 'story', 'whatsapp', 'outro'] as const
export type Source = (typeof SOURCES)[number]
export const SOURCE_LABEL: Record<Source, string> = {
  direto: 'Link direto', qr: 'QR Code', bio: 'Bio do Instagram', story: 'Story', whatsapp: 'WhatsApp', outro: 'Outras origens',
}
/** Origens que a própria loja marca nos links que compartilha (?o=bio, ?o=story…). O resto da URL é ignorado. */
export const SHARE_SOURCES = ['qr', 'bio', 'story', 'whatsapp'] as const

export function parseSource(raw: unknown): Source | '' {
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  return (SHARE_SOURCES as readonly string[]).includes(v) ? (v as Source) : ''
}

export const PERIODS = [7, 30, 90] as const
export type Period = (typeof PERIODS)[number]
export function parsePeriod(raw: unknown): Period {
  const n = Number(raw)
  return (PERIODS as readonly number[]).includes(n) ? (n as Period) : 30
}

type Totals = Record<'store_view' | 'collection_view' | 'product_view' | 'whatsapp_click' | 'share_click' | 'avise_click', number>

export type AnalyticsReport = {
  days: number
  totals: Totals
  previous: Totals
  daily: { day: string; views: number; contacts: number }[]
  sources: { source: Source; views: number }[]
  products: { id: string; name: string; slug: string; status: string; views: number; contacts: number; avise: number }[]
  collections: { id: string; name: string; views: number }[]
}

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0)
const totals = (v: unknown): Totals => {
  const o = (v ?? {}) as Record<string, unknown>
  return { store_view: n(o.store_view), collection_view: n(o.collection_view), product_view: n(o.product_view), whatsapp_click: n(o.whatsapp_click), share_click: n(o.share_click), avise_click: n(o.avise_click) }
}

export function parseReport(raw: unknown): AnalyticsReport {
  const o = (raw ?? {}) as Record<string, unknown>
  const list = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : [])
  return {
    days: n(o.days) || 30,
    totals: totals(o.totals),
    previous: totals(o.previous),
    daily: list(o.daily).map((d) => ({ day: String(d.day), views: n(d.views), contacts: n(d.contacts) })),
    sources: list(o.sources).map((s) => ({ source: (SOURCES as readonly string[]).includes(String(s.source)) ? (s.source as Source) : 'outro', views: n(s.views) })),
    products: list(o.products).map((p) => ({ id: String(p.id), name: String(p.name), slug: String(p.slug), status: String(p.status), views: n(p.views), contacts: n(p.contacts), avise: n(p.avise) })),
    collections: list(o.collections).map((c) => ({ id: String(c.id), name: String(c.name), views: n(c.views) })),
  }
}

export const totalViews = (t: Totals) => t.store_view + t.collection_view + t.product_view

/** "+25%", "−10%", "igual" ou "novo" (quando o período anterior foi zero). */
export function changeLabel(now: number, before: number): { text: string; tone: 'up' | 'down' | 'flat' } {
  if (before === 0) return now === 0 ? { text: 'sem dados', tone: 'flat' } : { text: 'novo', tone: 'up' }
  const pct = Math.round(((now - before) / before) * 100)
  if (pct === 0) return { text: 'igual ao período anterior', tone: 'flat' }
  return { text: `${pct > 0 ? '+' : '−'}${Math.abs(pct)}% vs. período anterior`, tone: pct > 0 ? 'up' : 'down' }
}

/** Conversão simples: de cada 100 visualizações de peça, quantos toques no WhatsApp. Sem peça vista, não há taxa. */
export function contactRate(t: Totals): number | null {
  return t.product_view > 0 ? Math.round((t.whatsapp_click / t.product_view) * 1000) / 10 : null
}
