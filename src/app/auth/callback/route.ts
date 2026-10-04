import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { safeNext } from '@/lib/safeNext'
import { siteUrl } from '@/lib/supabase/env'

/** Destino dos links de e-mail (confirmação, link mágico, recuperação de senha). */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const next = safeNext(request.nextUrl.searchParams.get('next'))
  const base = siteUrl()

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${base}${next}`)
  }
  return NextResponse.redirect(`${base}/entrar?erro=link`)
}
