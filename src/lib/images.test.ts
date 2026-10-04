import { describe, expect, it } from 'vitest'
import { fitWithin, imagePath, isValidImagePath, moveItem, nextKind, publicUrl, thumbPath } from './images'

const S = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const P = 'eeeeeeee-0000-0000-0000-000000000a01'
const I = '11111111-2222-3333-4444-555555555555'

describe('fitWithin', () => {
  it('reduz mantendo a proporção', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 })
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 })
  })
  it('nunca amplia', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 })
  })
  it('nunca zera um lado e trata medidas inválidas', () => {
    expect(fitWithin(10000, 3, 1600).height).toBeGreaterThanOrEqual(1)
    expect(fitWithin(0, 10, 1600)).toEqual({ width: 0, height: 0 })
  })
})

describe('caminhos', () => {
  it('monta e valida o caminho da foto', () => {
    const p = imagePath(S, P, I, 'webp')
    expect(p).toBe(`stores/${S}/products/${P}/${I}.webp`)
    expect(isValidImagePath(p, S, P)).toBe(true)
    expect(isValidImagePath(imagePath(S, P, I, 'jpg'), S, P)).toBe(true)
  })
  it('recusa caminho de outra loja, outro produto ou formato estranho', () => {
    const other = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    expect(isValidImagePath(imagePath(other, P, I, 'webp'), S, P)).toBe(false)
    expect(isValidImagePath(imagePath(S, 'eeeeeeee-0000-0000-0000-000000000b01', I, 'webp'), S, P)).toBe(false)
    expect(isValidImagePath(`stores/${S}/products/${P}/../x.webp`, S, P)).toBe(false)
    expect(isValidImagePath(`stores/${S}/products/${P}/${I}.exe`, S, P)).toBe(false)
    expect(isValidImagePath(`stores/${S}/products/${P}/${I}.webp/extra`, S, P)).toBe(false)
    expect(isValidImagePath(`stores/${S}/branding/${I}.webp`, S, P)).toBe(false)
  })
  it('miniatura fica ao lado da foto', () => {
    expect(thumbPath(`a/b/${I}.webp`)).toBe(`a/b/${I}_thumb.webp`)
    expect(thumbPath(`a/b/${I}.jpg`)).toBe(`a/b/${I}_thumb.jpg`)
  })
  it('monta o endereço público', () => {
    expect(publicUrl('https://x.supabase.co/', 'stores/a b/c.webp')).toBe('https://x.supabase.co/storage/v1/object/public/catalog/stores/a%20b/c.webp')
  })
})

describe('tipos e ordem', () => {
  it('sugere frente, costas, lateral, detalhe e depois "outra"', () => {
    expect(nextKind([])).toBe('front')
    expect(nextKind(['front'])).toBe('back')
    expect(nextKind(['front', 'side'])).toBe('back')
    expect(nextKind(['front', 'back', 'side', 'detail'])).toBe('other')
  })
  it('move itens sem alterar a lista original', () => {
    const l = ['a', 'b', 'c']
    expect(moveItem(l, 2, 0)).toEqual(['c', 'a', 'b'])
    expect(moveItem(l, 0, 1)).toEqual(['b', 'a', 'c'])
    expect(moveItem(l, 0, 5)).toEqual(l)
    expect(l).toEqual(['a', 'b', 'c'])
  })
})
