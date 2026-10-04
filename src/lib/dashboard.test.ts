import { describe, expect, it } from 'vitest'
import { activityVerb, isEmptyStore, parseDashboard, statusSegments, timeAgo } from './dashboard'

describe('parseDashboard', () => {
  it('lê a resposta do banco', () => {
    const d = parseDashboard({
      products: { total: 11, available: 7, reserved: 1, sold: 2, unavailable: 1, archived: 1, featured: 1 },
      collections: 2, categories: 1, team: 2, stock: { low: 2, out: 1 },
      recent: [{ id: 'x', name: 'P2', status: 'available', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z', actor: 'Alice' }],
    })
    expect(d.products.available).toBe(7)
    expect(d.stock.out).toBe(1)
    expect(d.recent[0].actor).toBe('Alice')
  })
  it('lixo, nulo ou ausente vira zero, sem quebrar a tela', () => {
    for (const bad of [null, undefined, {}, 'x', { products: 'ruim', stock: 5, recent: 'x' }]) {
      const d = parseDashboard(bad)
      expect(d.products.total).toBe(0)
      expect(d.collections).toBe(0)
      expect(d.recent).toEqual([])
      expect(isEmptyStore(d)).toBe(true)
    }
  })
  it('números vindos como texto são aceitos; negativos viram zero', () => {
    const d = parseDashboard({ collections: '3', team: -4 })
    expect(d.collections).toBe(3)
    expect(d.team).toBe(0)
  })
})

describe('statusSegments', () => {
  const p = (o: Partial<Record<string, number>>) => ({ total: 0, available: 0, reserved: 0, sold: 0, unavailable: 0, archived: 0, featured: 0, ...o })
  it('percentuais somam sempre 100', () => {
    for (const o of [{ available: 1, reserved: 1, sold: 1 }, { available: 7, reserved: 1, sold: 2, unavailable: 1 }, { available: 3 }]) {
      const sum = statusSegments(p(o)).reduce((a, s) => a + s.percent, 0)
      expect(sum).toBe(100)
    }
  })
  it('sem produtos tudo é zero e arquivados não entram', () => {
    expect(statusSegments(p({})).every((s) => s.percent === 0)).toBe(true)
    expect(statusSegments(p({ archived: 5 })).every((s) => s.count === 0)).toBe(true)
  })
})

describe('timeAgo e activityVerb', () => {
  const now = new Date('2026-10-04T12:00:00Z')
  it('formata em português', () => {
    expect(timeAgo('2026-10-04T11:59:40Z', now)).toBe('agora')
    expect(timeAgo('2026-10-04T11:55:00Z', now)).toBe('há 5 min')
    expect(timeAgo('2026-10-04T09:00:00Z', now)).toBe('há 3 h')
    expect(timeAgo('2026-10-03T10:00:00Z', now)).toBe('ontem')
    expect(timeAgo('2026-10-01T10:00:00Z', now)).toBe('há 3 dias')
    expect(timeAgo('2026-09-01T10:00:00Z', now)).toBe('01/09/2026')
    expect(timeAgo('lixo', now)).toBe('')
  })
  it('distingue adicionado de atualizado', () => {
    expect(activityVerb('2026-10-04T10:00:00Z', '2026-10-04T10:00:01Z')).toBe('adicionou')
    expect(activityVerb('2026-10-04T10:00:00Z', '2026-10-04T11:00:00Z')).toBe('atualizou')
  })
})
