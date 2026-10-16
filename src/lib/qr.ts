import QRCode from 'qrcode'

// Links e QR Codes da loja, de uma coleção ou de uma peça. O QR só codifica o endereço público: nada de dados da loja.

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

export type ShareTarget = { kind: 'loja' } | { kind: 'colecao'; slug: string } | { kind: 'produto'; slug: string }

/** "loja", "colecao:verao", "produto:vestido-midi" → alvo validado (ou null). Entrada do usuário: nada fora do padrão passa. */
export function parseShareTarget(raw: string | null | undefined): ShareTarget | null {
  const v = (raw ?? 'loja').trim().toLowerCase()
  if (v === 'loja') return { kind: 'loja' }
  const parts = v.split(':')
  if (parts.length !== 2) return null
  const [kind, slug] = parts
  if ((kind === 'colecao' || kind === 'produto') && slug && slug.length <= 80 && SLUG.test(slug)) return { kind, slug }
  return null
}

export const shareTargetParam = (t: ShareTarget) => (t.kind === 'loja' ? 'loja' : `${t.kind}:${t.slug}`)

export function sharePath(storeSlug: string, t: ShareTarget): string {
  if (t.kind === 'loja') return `/${storeSlug}`
  return `/${storeSlug}/${t.kind}/${t.slug}`
}

/** Endereço público; `source` (qr, bio, story, whatsapp) vira ?o= para as análises saberem de onde a visita veio. */
export const shareUrl = (site: string, storeSlug: string, t: ShareTarget, source?: 'qr' | 'bio' | 'story' | 'whatsapp') =>
  `${site.replace(/\/+$/, '')}${sharePath(storeSlug, t)}${source ? `?o=${source}` : ''}`

// QR sempre preto sobre branco (leitores de câmera falham com cores invertidas), com margem de silêncio e correção média.
const BASE = { margin: 2, errorCorrectionLevel: 'M' as const, color: { dark: '#000000', light: '#ffffff' } }

export const qrSvg = (url: string): Promise<string> => QRCode.toString(url, { ...BASE, type: 'svg' })
export const qrPng = (url: string, width = 1024): Promise<Buffer> => QRCode.toBuffer(url, { ...BASE, type: 'png', width })
