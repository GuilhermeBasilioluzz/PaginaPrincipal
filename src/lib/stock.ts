import { z } from 'zod'

export type MovementReason = 'initial' | 'restock' | 'sale' | 'adjustment' | 'return' | 'reserved' | 'reservation_released'
export type StockState = 'ok' | 'low' | 'reserved' | 'out'
export type ReservationStatus = 'requested' | 'confirmed' | 'picked_up' | 'cancelled'

export const STATE_LABEL: Record<StockState, string> = {
  ok: 'Em estoque', low: 'Poucas unidades', reserved: 'Tudo reservado', out: 'Esgotado',
}
export const RESERVATION_LABEL: Record<ReservationStatus, string> = {
  requested: 'Solicitada', confirmed: 'Confirmada', picked_up: 'Retirada', cancelled: 'Cancelada',
}

const n = z.coerce.number().int().catch(0)

export const totalsSchema = z.object({
  products: n, units: n, reserved: n, available: n, low: n, out: n, reservations: n,
})
export type StockTotals = z.infer<typeof totalsSchema>
export const parseTotals = (raw: unknown): StockTotals => totalsSchema.parse(typeof raw === 'object' && raw ? raw : {})

export type StockRow = {
  product_id: string; name: string; sku: string | null; status: string; quantity: number; reserved: number
  available: number; low_stock_threshold: number; stock_state: StockState
  reservations: { id: string; customer: string; quantity: number; status: ReservationStatus; size: string | null; by: string | null; at: string; expires_at: string | null }[]
  total: number
}

export type FeedItem = {
  id: string; created_at: string; reason: MovementReason; delta: number; quantity_after: number
  note: string | null; product_id: string; product_name: string; actor: string | null
}

const un = (q: number) => `${Math.abs(q)} un.`

/** Frase do histórico: "Bruno vendeu 2 un. de Vestido (sobraram 10)". */
export function describeMovement(m: FeedItem): string {
  const who = m.actor || 'Alguém da equipe'
  const p = m.product_name
  switch (m.reason) {
    case 'initial': return `${who} cadastrou ${p} com ${un(m.delta)} em estoque`
    case 'restock': return `${who} deu entrada de ${un(m.delta)} de ${p} (agora ${m.quantity_after})`
    case 'sale': return `${who} vendeu ${un(m.delta)} de ${p} (sobraram ${m.quantity_after})`
    case 'return': return `${who} registrou devolução de ${un(m.delta)} de ${p} (agora ${m.quantity_after})`
    case 'adjustment': return `${who} corrigiu o estoque de ${p}: ${m.delta > 0 ? '+' : '−'}${Math.abs(m.delta)} (agora ${m.quantity_after})`
    case 'reserved': return `${who} ${m.note?.startsWith('Reserva confirmada') ? 'confirmou' : 'reservou'} ${p}${m.note ? ` — ${m.note.replace(/^Reserva confirmada: /, 'para ').replace(/^Reservado para /, 'para ')}` : ''}`
    case 'reservation_released': return `${who} liberou a reserva de ${p}${m.note ? ` — ${m.note.replace(/^Reserva cancelada: /, 'era de ')}` : ''}`
  }
}

// ---- formulários
export const ADJUST_OPS = ['restock', 'sale', 'return', 'adjustment'] as const
export type AdjustOp = (typeof ADJUST_OPS)[number]

/** "+ Entrada" e "− Venda": a quantidade é sempre positiva na tela; o sinal vem da operação. */
export function readAdjustForm(fd: FormData): { ok: true; op: AdjustOp; delta: number; note: string } | { ok: false; error: string } {
  const op = String(fd.get('op') ?? '')
  const qty = String(fd.get('qty') ?? '').trim()
  if (!(ADJUST_OPS as readonly string[]).includes(op)) return { ok: false, error: 'Escolha a operação.' }
  if (!/^\d{1,5}$/.test(qty) || Number(qty) < 1) return { ok: false, error: 'Informe uma quantidade inteira maior que zero.' }
  const q = Number(qty)
  const delta = op === 'sale' ? -q : op === 'adjustment' && fd.get('sign') === '-' ? -q : q
  return { ok: true, op: op as AdjustOp, delta, note: String(fd.get('note') ?? '').trim().slice(0, 300) }
}

export const HOLD_OPTIONS: Record<string, { label: string; hours: number | null }> = {
  none: { label: 'Sem prazo', hours: null },
  '2h': { label: 'Por 2 horas', hours: 2 },
  '24h': { label: 'Por 24 horas', hours: 24 },
  '3d': { label: 'Por 3 dias', hours: 72 },
  '7d': { label: 'Por 7 dias', hours: 168 },
}

export const reservationSchema = z.object({
  product: z.string().regex(/^[0-9a-f-]{36}$/i, 'Escolha a peça.'),
  quantity: z.string().regex(/^\d{1,3}$/, 'Informe a quantidade.').refine((v) => Number(v) >= 1, 'A quantidade precisa ser pelo menos 1.'),
  customer: z.string().trim().min(1, 'Informe o nome da cliente.').max(80, 'O nome é longo demais.'),
  contact: z.string().trim().max(40, 'O contato é longo demais.').optional(),
  size: z.string().trim().max(12).optional(),
  note: z.string().trim().max(300, 'A observação é longa demais (máximo 300).').optional(),
  hold: z.string().refine((v) => v in HOLD_OPTIONS, 'Prazo inválido.'),
})

export function readReservationForm(fd: FormData, now: Date = new Date()) {
  const t = (k: string) => String(fd.get(k) ?? '')
  const r = reservationSchema.safeParse({
    product: t('product'), quantity: t('quantity'), customer: t('customer'), contact: t('contact'),
    size: t('size'), note: t('note'), hold: t('hold') || 'none',
  })
  if (!r.success) return { ok: false as const, error: r.error.issues[0]?.message ?? 'Dados inválidos.' }
  const hours = HOLD_OPTIONS[r.data.hold].hours
  return {
    ok: true as const,
    payload: {
      product: r.data.product, quantity: Number(r.data.quantity), customer: r.data.customer,
      contact: r.data.contact ?? '', size: r.data.size ?? '', note: r.data.note ?? '',
      expires: hours === null ? null : new Date(now.getTime() + hours * 3_600_000).toISOString(),
    },
  }
}

// ---- tempo real
/**
 * Junta uma rajada de eventos numa única atualização (ex.: uma retirada gera 3 mudanças seguidas).
 * Devolve a função a chamar a cada evento e outra para cancelar.
 */
export function createDebounced(fn: () => void, wait: number, timers = { set: setTimeout, clear: clearTimeout }) {
  let t: ReturnType<typeof setTimeout> | undefined
  return {
    call() { if (t !== undefined) timers.clear(t); t = timers.set(() => { t = undefined; fn() }, wait) },
    cancel() { if (t !== undefined) timers.clear(t); t = undefined },
  }
}
