import { describe, expect, it } from 'vitest'
import { changeLabel, contactRate, parsePeriod, parseReport, parseSource, totalViews } from './analytics'

describe('origem e período', () => {
  it('só aceita as origens que a loja marca nos links', () => {
    expect(parseSource('BIO')).toBe('bio')
    expect(parseSource(' story ')).toBe('story')
    for (const bad of ['', 'google', 'direto', 'outro', '<script>', null, 5]) expect(parseSource(bad)).toBe('')
  })
  it('período inválido vira 30 dias', () => {
    expect(parsePeriod('7')).toBe(7)
    expect(parsePeriod('90')).toBe(90)
    for (const bad of [undefined, '5', '9999', 'abc']) expect(parsePeriod(bad)).toBe(30)
  })
})

describe('números', () => {
  const t = (o: Partial<Record<string, number>>) => ({ store_view: 0, collection_view: 0, product_view: 0, whatsapp_click: 0, share_click: 0, avise_click: 0, ...o })
  it('variação em português', () => {
    expect(changeLabel(15, 10)).toEqual({ text: '+50% vs. período anterior', tone: 'up' })
    expect(changeLabel(9, 10)).toEqual({ text: '−10% vs. período anterior', tone: 'down' })
    expect(changeLabel(10, 10).tone).toBe('flat')
    expect(changeLabel(5, 0)).toEqual({ text: 'novo', tone: 'up' })
    expect(changeLabel(0, 0).text).toBe('sem dados')
  })
  it('visualizações somam loja, coleção e peça', () => {
    expect(totalViews(t({ store_view: 3, collection_view: 2, product_view: 5, whatsapp_click: 9 }))).toBe(10)
  })
  it('taxa de contato só existe com peça vista', () => {
    expect(contactRate(t({ product_view: 0, whatsapp_click: 4 }))).toBeNull()
    expect(contactRate(t({ product_view: 40, whatsapp_click: 3 }))).toBe(7.5)
  })
})

describe('parseReport', () => {
  it('lixo vira relatório vazio e origem desconhecida vira "outro"', () => {
    const r = parseReport(null)
    expect(r.days).toBe(30)
    expect(r.daily).toEqual([])
    expect(parseReport({ sources: [{ source: 'x', views: '4' }] }).sources).toEqual([{ source: 'outro', views: 4 }])
  })
  it('converte números vindos como texto', () => {
    expect(parseReport({ totals: { store_view: '12' } }).totals.store_view).toBe(12)
  })
})
