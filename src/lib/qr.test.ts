import { describe, expect, it } from 'vitest'
import { parseShareTarget, qrPng, qrSvg, sharePath, shareTargetParam, shareUrl } from './qr'

describe('parseShareTarget', () => {
  it('aceita loja, coleção e produto', () => {
    expect(parseShareTarget(undefined)).toEqual({ kind: 'loja' })
    expect(parseShareTarget('loja')).toEqual({ kind: 'loja' })
    expect(parseShareTarget('colecao:verao-2026')).toEqual({ kind: 'colecao', slug: 'verao-2026' })
    expect(parseShareTarget(' PRODUTO:vestido-midi ')).toEqual({ kind: 'produto', slug: 'vestido-midi' })
  })
  it('recusa qualquer coisa fora do padrão (a entrada vem da URL)', () => {
    for (const bad of ['', 'colecao', 'colecao:', 'colecao:../x', 'produto:a/b', 'produto:Vestido Midi', 'http://evil.com', 'outro:x', 'produto:' + 'a'.repeat(81), 'produto:-x', 'colecao:a:b']) {
      expect(parseShareTarget(bad), bad).toBeNull()
    }
  })
})

describe('links', () => {
  it('monta caminho e URL, sem barra duplicada', () => {
    expect(sharePath('aurora', { kind: 'loja' })).toBe('/aurora')
    expect(sharePath('aurora', { kind: 'colecao', slug: 'novidades' })).toBe('/aurora/colecao/novidades')
    expect(shareUrl('https://x.vercel.app/', 'aurora', { kind: 'produto', slug: 'saia' })).toBe('https://x.vercel.app/aurora/produto/saia')
    expect(shareUrl('https://x.vercel.app', 'aurora', { kind: 'loja' }, 'bio')).toBe('https://x.vercel.app/aurora?o=bio')
  })
  it('o parâmetro volta a ser lido igual', () => {
    for (const t of [{ kind: 'loja' as const }, { kind: 'colecao' as const, slug: 'a1' }, { kind: 'produto' as const, slug: 'b2' }]) {
      expect(parseShareTarget(shareTargetParam(t))).toEqual(t)
    }
  })
})

describe('QR', () => {
  it('SVG preto sobre branco', async () => {
    const svg = await qrSvg('https://x.vercel.app/aurora')
    expect(svg).toContain('<svg')
    expect(svg.toLowerCase()).toContain('#000000')
    expect(svg.toLowerCase()).toContain('#ffffff')
  })
  it('PNG válido', async () => {
    const png = await qrPng('https://x.vercel.app/aurora', 512)
    expect([...png.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47])
  })
})
