import { NextResponse } from 'next/server'
import { createPublicClient } from '@/lib/supabase/public'
import { isEventKind, parseSource } from '@/lib/analytics'

export const dynamic = 'force-dynamic'

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** Recebe um evento anônimo do catálogo. Responde sempre 204 quando o formato está certo: quem visita não precisa saber se contou. */
export async function POST(request: Request) {
  let body: unknown
  try {
    if (Number(request.headers.get('content-length') ?? 0) > 1024) return new NextResponse(null, { status: 413 })
    body = JSON.parse(await request.text())
  } catch { return new NextResponse(null, { status: 400 }) }
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const loja = typeof b.loja === 'string' ? b.loja : ''
  const ref = typeof b.ref === 'string' ? b.ref : ''
  if (!SLUG.test(loja) || loja.length > 40 || !isEventKind(b.tipo) || (ref && (!SLUG.test(ref) || ref.length > 80))) {
    return new NextResponse(null, { status: 400 })
  }
  const supabase = createPublicClient()
  if (supabase) await supabase.rpc('track_event', { p_store: loja, p_kind: b.tipo, p_ref: ref, p_source: parseSource(b.origem) })
  return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
}
