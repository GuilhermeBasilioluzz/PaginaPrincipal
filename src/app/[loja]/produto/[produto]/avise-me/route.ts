import { NextResponse, type NextRequest } from 'next/server'
import { customerMessage, productUrl } from '@/lib/interest'
import { getCatalogProduct } from '@/lib/publicProduct'
import { createPublicClient } from '@/lib/supabase/public'
import { siteUrl } from '@/lib/supabase/env'
import { whatsappUrl } from '@/lib/storeSettings'

/**
 * Botão "Avise-me quando chegar": conta UM clique anônimo (por peça e dia, sem dados pessoais) e leva a cliente ao
 * WhatsApp da loja com a mensagem pronta. É POST para robôs de busca e pré-visualizações não inflarem a contagem.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ loja: string; produto: string }> }) {
  const { loja, produto } = await params
  const base = siteUrl()
  const back = (query = '') => NextResponse.redirect(`${base}/${encodeURIComponent(loja)}/produto/${encodeURIComponent(produto)}${query}`, 303)

  // só aceita o botão do próprio site
  const origin = request.headers.get('origin')
  if (origin && new URL(origin).host !== new URL(base).host && new URL(origin).host !== request.headers.get('host')) {
    return new NextResponse('Origem não permitida', { status: 403 })
  }

  const page = await getCatalogProduct(loja, produto)
  if (!page || !page.interest_open) return back()

  const supabase = createPublicClient()
  if (supabase) await supabase.rpc('register_interest_click', { p_store: loja, p_product: produto }) // falha de contagem não impede o contato

  if (!page.store.whatsapp) return back('?aviso=sem-whatsapp')
  const text = customerMessage(page.product.stock_label, page.product.name, productUrl(base, page.store.slug, page.product.slug))
  return NextResponse.redirect(whatsappUrl(page.store.whatsapp, text), 303)
}
