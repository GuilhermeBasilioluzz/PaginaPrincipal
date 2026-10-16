import { NextResponse, type NextRequest } from 'next/server'
import { getCatalogStore } from '@/lib/publicCatalog'
import { getCatalogProduct } from '@/lib/publicProduct'
import { parseShareTarget, qrPng, qrSvg, shareUrl } from '@/lib/qr'
import { siteUrl } from '@/lib/supabase/env'

export const dynamic = 'force-dynamic'

const notFound = () => new NextResponse('Não encontrado', { status: 404, headers: { 'Cache-Control': 'no-store' } })

/** QR Code público da loja, de uma coleção ou de uma peça: /{loja}/qr?para=loja|colecao:slug|produto:slug&formato=svg|png */
export async function GET(request: NextRequest, { params }: { params: Promise<{ loja: string }> }) {
  const { loja } = await params
  const sp = request.nextUrl.searchParams
  const target = parseShareTarget(sp.get('para'))
  if (!target) return notFound()

  const catalog = await getCatalogStore(loja)
  if (!catalog) return notFound() // loja inexistente, desligada ou desativada: sem QR
  if (target.kind === 'colecao' && !catalog.collections.some((c) => c.slug === target.slug)) return notFound()
  if (target.kind === 'produto' && !(await getCatalogProduct(loja, target.slug))) return notFound()

  const url = shareUrl(siteUrl(), catalog.store.slug, target, 'qr')
  const png = sp.get('formato') === 'png'
  const body = png ? new Uint8Array(await qrPng(url)) : await qrSvg(url)
  const name = `qr-${catalog.store.slug}${target.kind === 'loja' ? '' : `-${target.slug}`}.${png ? 'png' : 'svg'}`
  return new NextResponse(body, {
    headers: {
      'Content-Type': png ? 'image/png' : 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'X-Robots-Tag': 'noindex',
      ...(sp.get('baixar') === '1' ? { 'Content-Disposition': `attachment; filename="${name}"` } : {}),
    },
  })
}
