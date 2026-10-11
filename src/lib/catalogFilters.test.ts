import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FILTERS, FILTER_KEYS, cleanStyles, normalizeFilters, readCatalogFilters, suggestedCategoryItems,
} from './catalogFilters'
import { applyEnabledFilters, catalogHref, parseCatalogQuery, activeFilters, DEFAULT_QUERY } from './catalog'
import { readProductForm } from './products'

const form = (entries: [string, string][]) => { const fd = new FormData(); for (const [k, v] of entries) fd.append(k, v); return fd }
const allOn = FILTER_KEYS.map((k) => [`f_${k}`, 'on'] as [string, string])

describe('normalizeFilters', () => {
  it('lixo vira o padrão', () => {
    expect(normalizeFilters(null)).toEqual(DEFAULT_FILTERS)
    expect(normalizeFilters('x')).toEqual(DEFAULT_FILTERS)
  })
  it('respeita booleanos válidos e ignora públicos inventados', () => {
    const f = normalizeFilters({ audience: true, color: false, audiences: ['masculine', 'alien', 'unisex'], styles: [' Festa ', 'festa', 'Praia'] })
    expect(f.audience).toBe(true)
    expect(f.color).toBe(false)
    expect(f.audiences).toEqual(['masculine', 'unisex'])
    expect(f.styles).toEqual(['Festa', 'Praia'])
  })
  it('sem nenhum público válido volta ao padrão (feminino)', () => {
    expect(normalizeFilters({ audiences: ['alien'] }).audiences).toEqual(['feminine'])
  })
})

describe('readCatalogFilters', () => {
  it('lê checkboxes, públicos e estilos', () => {
    const r = readCatalogFilters(form([...allOn.filter(([k]) => k !== 'f_stock'), ['audiences', 'feminine'], ['audiences', 'kids'], ['styles', 'Casual, Festa ,, Casual']]))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.filters.stock).toBe(false)
      expect(r.filters.search).toBe(true)
      expect(r.filters.audiences).toEqual(['feminine', 'kids'])
      expect(r.filters.styles).toEqual(['Casual', 'Festa'])
    }
  })
  it('recusa sem público', () => {
    expect(readCatalogFilters(form(allOn)).ok).toBe(false)
  })
  it('recusa estilo longo e excesso de estilos', () => {
    expect(readCatalogFilters(form([['audiences', 'feminine'], ['styles', 'x'.repeat(31)]])).ok).toBe(false)
    expect(readCatalogFilters(form([['audiences', 'feminine'], ['styles', Array.from({ length: 13 }, (_, i) => `e${i}`).join(',')]])).ok).toBe(false)
  })
  it('estilo com caracteres perigosos é limpo', () => {
    expect(cleanStyles(['<b>Chic</b>', '"x"'])).toEqual(['bChic/b', 'x'])
  })
})

describe('consulta do catálogo com público e estilo', () => {
  it('lê da URL e descarta público inválido', () => {
    expect(parseCatalogQuery({ publico: 'masculine', estilo: 'Festa' })).toMatchObject({ audience: 'masculine', style: 'Festa' })
    expect(parseCatalogQuery({ publico: 'alien' }).audience).toBe('')
  })
  it('escreve na URL só o que não é padrão', () => {
    expect(catalogHref('/l', { ...DEFAULT_QUERY, audience: 'kids', style: 'Casual' })).toBe('/l?publico=kids&estilo=Casual')
    expect(catalogHref('/l', DEFAULT_QUERY)).toBe('/l')
  })
  it('filtros ativos listam público e estilo', () => {
    const labels = activeFilters('/l', { ...DEFAULT_QUERY, audience: 'feminine', style: 'Festa' }).map((f) => f.label)
    expect(labels).toEqual(['Feminino', 'Estilo: Festa'])
  })
  it('filtro desligado pela loja é ignorado mesmo vindo pela URL', () => {
    const q = parseCatalogQuery({ publico: 'kids', estilo: 'Festa', cor: 'Preto', min: '10', ordem: 'name', estoque: '1', q: 'oi', categoria: 'x' })
    const off = applyEnabledFilters(q, { ...DEFAULT_FILTERS, audience: false, style: false, color: false, price: false, sort: false, stock: false, search: false, category: false })
    expect(off).toEqual({ ...DEFAULT_QUERY })
    const on = applyEnabledFilters(q, { ...DEFAULT_FILTERS, audience: true, style: true })
    expect(on).toMatchObject({ audience: 'kids', style: 'Festa', color: 'Preto', min: 10, sort: 'name', stock: true, q: 'oi', category: 'x' })
  })
})

describe('cadastro de peça com público e estilos', () => {
  const base: [string, string][] = [['name', 'Blusa'], ['price', '50'], ['quantity', '2']]
  it('inclui público e estilos quando enviados', () => {
    const r = readProductForm(form([...base, ['audience', 'unisex'], ['styles_present', '1'], ['styles', 'Casual'], ['styles', ' casual '], ['styles', 'Festa']]))
    expect(r.ok && r.payload.audience).toBe('unisex')
    expect(r.ok && r.payload.styles).toEqual(['Casual', 'Festa'])
  })
  it('sem os campos não manda nada (banco mantém o atual)', () => {
    const r = readProductForm(form(base))
    expect(r.ok && 'audience' in r.payload).toBe(false)
    expect(r.ok && 'styles' in r.payload).toBe(false)
  })
  it('estilos zerados explicitamente limpam a lista', () => {
    const r = readProductForm(form([...base, ['styles_present', '1']]))
    expect(r.ok && r.payload.styles).toEqual([])
  })
  it('público inválido e estilos demais são recusados', () => {
    expect(readProductForm(form([...base, ['audience', 'alien']])).ok).toBe(false)
    expect(readProductForm(form([...base, ...Array.from({ length: 9 }, (_, i) => ['styles', `s${i}`] as [string, string])])).ok).toBe(false)
  })
})

describe('categorias sugeridas', () => {
  it('geram slug sem acento e sem repetir', () => {
    const items = suggestedCategoryItems('feminine')
    expect(items.find((i) => i.name === 'Calças')?.slug).toBe('calcas')
    expect(new Set(items.map((i) => i.slug)).size).toBe(items.length)
  })
  it('tipo desconhecido não gera nada', () => {
    expect(suggestedCategoryItems('x')).toEqual([])
  })
})
