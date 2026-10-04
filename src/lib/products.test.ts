import { describe, expect, it } from 'vitest'
import { formatBRL, formatInput, parseBRL } from './money'
import { parseSizes, splitSizes } from './sizes'
import { listFilter, pageNumber, readProductForm, searchTerm } from './products'

describe('parseBRL', () => {
  it('entende o padrão brasileiro', () => {
    expect(parseBRL('189,90')).toBe(189.9)
    expect(parseBRL('R$ 189,90')).toBe(189.9)
    expect(parseBRL('1.234,56')).toBe(1234.56)
    expect(parseBRL('1234,5')).toBe(1234.5)
    expect(parseBRL('189')).toBe(189)
    expect(parseBRL('0')).toBe(0)
  })
  it('aceita ponto decimal e ponto de milhar sem ambiguidade', () => {
    expect(parseBRL('189.90')).toBe(189.9)
    expect(parseBRL('1.234')).toBe(1234)
    expect(parseBRL('1.234.567')).toBe(1234567)
  })
  it('recusa o que não é preço', () => {
    for (const bad of ['', '  ', 'abc', '-5', '12,3,4', '1,2,3', '10.000.0', '99999999', '12a', '--1']) expect(parseBRL(bad)).toBeNull()
  })
  it('arredonda em centavos', () => {
    expect(parseBRL('10,999')).toBe(11)
  })
  it('formata de volta', () => {
    expect(formatBRL(189.9).replace(/\s/g, ' ')).toBe('R$ 189,90')
    expect(formatInput(189.9)).toBe('189,90')
    expect(formatInput(null)).toBe('')
  })
})

describe('tamanhos', () => {
  it('junta marcados e digitados, sem repetir', () => {
    expect(parseSizes(['P', 'M'], 'm, 48 ; Plus,, ')).toEqual(['P', 'M', '48', 'Plus'])
  })
  it('padroniza letras curtas em maiúsculas', () => {
    expect(parseSizes([], 'pp, xg, único')).toEqual(['PP', 'XG', 'único'])
  })
  it('separa o que vira botão do que vira texto livre', () => {
    expect(splitSizes(['P', '40', '48', 'Plus'])).toEqual({ checked: ['P', '40'], extra: '48, Plus' })
  })
})

function form(o: Record<string, string | string[]>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(o)) (Array.isArray(v) ? v : [v]).forEach((x) => fd.append(k, x))
  return fd
}

describe('readProductForm', () => {
  const base = { name: '  Vestido Midi ', price: '189,90', quantity: '5', status: 'available' }
  it('monta o payload', () => {
    const r = readProductForm(form({ ...base, sizes: ['P', 'M'], sizesExtra: '48', featured: 'on', promo: '149,90', color: 'Terracota' }))
    expect(r.ok && r.payload).toMatchObject({ name: 'Vestido Midi', slug_base: 'vestido-midi', price: 189.9, promo_price: 149.9, quantity: 5, sizes: ['P', 'M', '48'], featured: true, status: 'available' })
  })
  it('promoção vazia vira nula e destaque ausente vira falso', () => {
    const r = readProductForm(form(base))
    expect(r.ok && r.payload.promo_price).toBeNull()
    expect(r.ok && r.payload.featured).toBe(false)
  })
  it('mensagens claras para cada erro', () => {
    const err = (o: object) => { const r = readProductForm(form({ ...base, ...o })); return r.ok ? null : r.error }
    expect(err({ name: '  ' })).toContain('nome')
    expect(err({ price: 'abc' })).toContain('preço válido')
    expect(err({ promo: '200,00' })).toContain('menor que o preço')
    expect(err({ promo: '189,90' })).toContain('menor que o preço')
    expect(err({ quantity: '-1' })).toContain('quantidade')
    expect(err({ quantity: '' })).toContain('quantidade')
    expect(err({ quantity: '2,5' })).toContain('quantidade')
    expect(err({ video: 'javascript:alert(1)' })).toContain('http')
    expect(err({ status: 'archived' })).not.toBeNull()
    expect(err({ category: 'x' })).toContain('Categoria')
    expect(err({ sku: 'x'.repeat(41) })).toContain('código')
  })
  it('na edição de arquivado, o status não é enviado', () => {
    const r = readProductForm(form({ ...base, status: 'sold' }), { keepStatus: true })
    expect(r.ok && 'status' in r.payload).toBe(false)
  })
  it('nome só com símbolos usa "produto" como endereço', () => {
    const r = readProductForm(form({ ...base, name: '!!!' }))
    expect(r.ok && r.payload.slug_base).toBe('produto')
  })
})

describe('busca e paginação', () => {
  it('limpa caracteres que quebrariam o filtro', () => {
    expect(searchTerm('vestido,preto)')).toBe('vestido preto')
    expect(searchTerm('a%b*c\\d"e')).toBe('a b c d e')
    expect(searchTerm('x'.repeat(200)).length).toBe(60)
    expect(searchTerm(undefined)).toBe('')
  })
  it('filtro e página inválidos viram o padrão', () => {
    expect(listFilter('sold')).toBe('sold')
    expect(listFilter('drop table')).toBe('all')
    expect(pageNumber('3')).toBe(3)
    for (const bad of ['0', '-1', 'abc', '99999999', undefined]) expect(pageNumber(bad)).toBe(1)
  })
})
