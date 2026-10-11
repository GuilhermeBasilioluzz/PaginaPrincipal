import { describe, expect, it } from 'vitest'
import { activeFilters, catalogHref, discountPercent, parseCatalogQuery, sortSizes, DEFAULT_QUERY } from './catalog'
import { formatWhatsapp, normalizeInstagram, normalizeWhatsapp, readStoreSettings, whatsappUrl } from './storeSettings'
import { brandingPath, isValidBrandingPath } from './images'

describe('parseCatalogQuery', () => {
  it('lê os filtros', () => {
    const q = parseCatalogQuery({ q: 'vestido preto', categoria: 'vestidos', cor: 'Verde', tamanho: 'M', min: '50,5', max: '200', estoque: '1', ordem: 'price_asc', pagina: '3' })
    expect(q).toEqual({ q: 'vestido preto', category: 'vestidos', audience: '', style: '', color: 'Verde', size: 'M', min: 50.5, max: 200, stock: true, sort: 'price_asc', page: 3 })
  })
  it('tudo ausente = padrão', () => {
    expect(parseCatalogQuery({})).toEqual(DEFAULT_QUERY)
  })
  it('descarta entradas hostis ou inválidas', () => {
    const q = parseCatalogQuery({ categoria: '../etc/passwd', cor: '<script>alert(1)</script>', tamanho: 'x'.repeat(50), min: 'abc', ordem: 'drop table', pagina: '-5', q: "a,b)'" })
    expect(q.category).toBe('')
    expect(q.color).not.toContain('<')
    expect(q.size.length).toBeLessThanOrEqual(12)
    expect(q.min).toBeNull()
    expect(q.sort).toBe('new')
    expect(q.page).toBe(1)
    expect(q.q).not.toMatch(/[,()']/)
  })
  it('troca mínimo e máximo quando vêm invertidos', () => {
    const q = parseCatalogQuery({ min: '300', max: '100' })
    expect([q.min, q.max]).toEqual([100, 300])
  })
  it('aceita parâmetro repetido (usa o primeiro)', () => {
    expect(parseCatalogQuery({ cor: ['Azul', 'Preto'] }).color).toBe('Azul')
  })
})

describe('catalogHref e filtros ativos', () => {
  it('só escreve o que não é padrão', () => {
    expect(catalogHref('/loja', DEFAULT_QUERY)).toBe('/loja')
    expect(catalogHref('/loja', { ...DEFAULT_QUERY, category: 'vestidos', page: 2, min: 50.5 })).toBe('/loja?categoria=vestidos&min=50%2C5&pagina=2')
  })
  it('override troca partes', () => {
    expect(catalogHref('/loja', { ...DEFAULT_QUERY, color: 'Azul', page: 3 }, { page: 1, color: '' })).toBe('/loja')
  })
  it('cada filtro ativo tem um link que o remove e volta à página 1', () => {
    const q = { ...DEFAULT_QUERY, q: 'vestido', color: 'Azul', stock: true, min: 10, max: 50, page: 4 }
    const f = activeFilters('/loja', q)
    expect(f.map((x) => x.label)).toEqual(['Busca: vestido', 'Cor: Azul', 'R$ 10 a 50', 'Só com estoque'])
    expect(f[1].href).toBe('/loja?q=vestido&min=10&max=50&estoque=1')
  })
})

describe('tamanhos e desconto', () => {
  it('ordena PP→XG, Único, números, resto', () => {
    expect(sortSizes(['42', 'G', 'Único', '38', 'P', 'Plus', 'PP', 'M', '40'])).toEqual(['PP', 'P', 'M', 'G', 'Único', '38', '40', '42', 'Plus'])
  })
  it('desconto só quando há promoção real', () => {
    expect(discountPercent(200, 150)).toBe(25)
    expect(discountPercent(200, null)).toBeNull()
    expect(discountPercent(200, 200)).toBeNull()
  })
})

describe('whatsapp e instagram', () => {
  it('normaliza telefone brasileiro', () => {
    expect(normalizeWhatsapp('(84) 99999-0000')).toBe('5584999990000')
    expect(normalizeWhatsapp('+55 84 99999-0000')).toBe('5584999990000')
    expect(normalizeWhatsapp('84 3333-0000')).toBe('558433330000')
    expect(normalizeWhatsapp('')).toBe('')
    for (const bad of ['123', 'abc', '55 84 9', '0000000000000000000']) expect(normalizeWhatsapp(bad)).toBeNull()
  })
  it('formata e monta o link', () => {
    expect(formatWhatsapp('5584999990000')).toBe('(84) 99999-0000')
    expect(whatsappUrl('5584999990000', 'Oi! Vi no catálogo')).toBe('https://wa.me/5584999990000?text=Oi!%20Vi%20no%20cat%C3%A1logo')
  })
  it('extrai o @ do Instagram de qualquer formato', () => {
    for (const ok of ['@minha.loja', 'minha.loja', 'instagram.com/minha.loja/', 'https://www.instagram.com/minha.loja?igsh=abc']) expect(normalizeInstagram(ok)).toBe('minha.loja')
    expect(normalizeInstagram('')).toBe('')
    for (const bad of ['@@@', 'a b', 'x'.repeat(31), 'https://evil.com/x y']) expect(normalizeInstagram(bad)).toBeNull()
  })
})

function form(o: Record<string, string>) { const fd = new FormData(); for (const [k, v] of Object.entries(o)) fd.append(k, v); return fd }

describe('readStoreSettings', () => {
  const base = { name: ' Boutique Aurora ', whatsapp: '(84) 99999-0000', instagram: '@aurora', accent: '' }
  it('monta o payload; vazio vira nulo; checkboxes ausentes viram falso', () => {
    const r = readStoreSettings(form({ ...base, tagline: 'Moda feminina', catalogEnabled: 'on' }))
    expect(r.ok && r.payload).toMatchObject({ name: 'Boutique Aurora', tagline: 'Moda feminina', whatsapp: '5584999990000', instagram_handle: 'aurora', description: null, accent_color: null, catalog_enabled: true, hide_sold_out: false })
  })
  it('mensagens claras', () => {
    const err = (o: object) => { const r = readStoreSettings(form({ ...base, ...o })); return r.ok ? null : r.error }
    expect(err({ name: ' ' })).toContain('nome')
    expect(err({ whatsapp: '123' })).toContain('WhatsApp')
    expect(err({ instagram: 'a b' })).toContain('Instagram')
    expect(err({ accent: 'azul' })).toContain('#RRGGBB')
    expect(err({ description: 'x'.repeat(601) })).toContain('600')
  })
})

describe('caminhos de logo e banner', () => {
  const S = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  const I = '11111111-2222-3333-4444-555555555555'
  it('monta e valida', () => {
    const p = brandingPath(S, 'logo', I, 'webp')
    expect(isValidBrandingPath(p, S, 'logo')).toBe(true)
    expect(isValidBrandingPath(p, S, 'banner')).toBe(false)
    expect(isValidBrandingPath(p, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'logo')).toBe(false)
    expect(isValidBrandingPath(`stores/${S}/products/x/${I}.webp`, S, 'logo')).toBe(false)
  })
})
