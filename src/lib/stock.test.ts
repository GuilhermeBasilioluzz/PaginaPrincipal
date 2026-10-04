import { describe, expect, it, vi } from 'vitest'
import { createDebounced, describeMovement, parseTotals, readAdjustForm, readReservationForm, type FeedItem } from './stock'

const m = (o: Partial<FeedItem>): FeedItem => ({
  id: '1', created_at: '2026-10-04T10:00:00Z', reason: 'sale', delta: -2, quantity_after: 10, note: null,
  product_id: 'p', product_name: 'Vestido', actor: 'Bruno', ...o,
})

function form(o: Record<string, string>) { const fd = new FormData(); for (const [k, v] of Object.entries(o)) fd.append(k, v); return fd }

describe('describeMovement', () => {
  it('frases claras para cada tipo', () => {
    expect(describeMovement(m({}))).toBe('Bruno vendeu 2 un. de Vestido (sobraram 10)')
    expect(describeMovement(m({ reason: 'restock', delta: 5, quantity_after: 15 }))).toBe('Bruno deu entrada de 5 un. de Vestido (agora 15)')
    expect(describeMovement(m({ reason: 'initial', delta: 10 }))).toBe('Bruno cadastrou Vestido com 10 un. em estoque')
    expect(describeMovement(m({ reason: 'adjustment', delta: -1, quantity_after: 12 }))).toBe('Bruno corrigiu o estoque de Vestido: −1 (agora 12)')
    expect(describeMovement(m({ reason: 'return', delta: 1, quantity_after: 11 }))).toContain('devolução')
  })
  it('reservas mostram para quem', () => {
    expect(describeMovement(m({ reason: 'reserved', delta: 0, note: 'Reservado para Maria' }))).toBe('Bruno reservou Vestido — para Maria')
    expect(describeMovement(m({ reason: 'reserved', delta: 0, note: 'Reserva confirmada: Maria' }))).toBe('Bruno confirmou Vestido — para Maria')
    expect(describeMovement(m({ reason: 'reservation_released', delta: 0, note: 'Reserva cancelada: Maria' }))).toBe('Bruno liberou a reserva de Vestido — era de Maria')
  })
  it('sem autor conhecido', () => {
    expect(describeMovement(m({ actor: null }))).toMatch(/^Alguém da equipe vendeu/)
  })
})

describe('readAdjustForm', () => {
  it('entrada soma, venda subtrai', () => {
    const a = readAdjustForm(form({ op: 'restock', qty: '3' }))
    expect(a.ok && a.delta).toBe(3)
    const b = readAdjustForm(form({ op: 'sale', qty: '2' }))
    expect(b.ok && b.delta).toBe(-2)
    const c = readAdjustForm(form({ op: 'adjustment', qty: '1', sign: '-' }))
    expect(c.ok && c.delta).toBe(-1)
  })
  it('recusa quantidade inválida e operação desconhecida', () => {
    for (const q of ['', '0', '-1', '1.5', 'a', '1000000']) expect(readAdjustForm(form({ op: 'sale', qty: q })).ok).toBe(false)
    expect(readAdjustForm(form({ op: 'reserved', qty: '1' })).ok).toBe(false)
  })
})

describe('readReservationForm', () => {
  const base = { product: 'eeeeeeee-0000-0000-0000-000000000a01', quantity: '2', customer: ' Maria ', hold: '24h' }
  it('calcula a validade a partir de agora', () => {
    const now = new Date('2026-10-04T12:00:00Z')
    const r = readReservationForm(form(base), now)
    expect(r.ok && r.payload.expires).toBe('2026-10-05T12:00:00.000Z')
    expect(r.ok && r.payload.customer).toBe('Maria')
    const none = readReservationForm(form({ ...base, hold: 'none' }), now)
    expect(none.ok && none.payload.expires).toBeNull()
  })
  it('mensagens claras', () => {
    const err = (o: object) => { const r = readReservationForm(form({ ...base, ...o })); return r.ok ? null : r.error }
    expect(err({ customer: '  ' })).toContain('cliente')
    expect(err({ quantity: '0' })).toContain('pelo menos 1')
    expect(err({ quantity: 'x' })).toContain('quantidade')
    expect(err({ product: 'drop' })).toContain('peça')
    expect(err({ hold: '999d' })).toContain('Prazo')
  })
})

describe('totais e tempo real', () => {
  it('lê os totais e zera o que vier errado', () => {
    expect(parseTotals({ units: 10, reserved: '3' }).reserved).toBe(3)
    expect(parseTotals(null).units).toBe(0)
  })
  it('junta uma rajada de eventos em uma só atualização', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const d = createDebounced(fn, 300)
    d.call(); d.call(); d.call()
    vi.advanceTimersByTime(299); expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(2); expect(fn).toHaveBeenCalledTimes(1)
    d.call(); d.cancel(); vi.advanceTimersByTime(1000); expect(fn).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
