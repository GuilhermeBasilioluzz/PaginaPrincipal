import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseEnv } from '@/lib/supabase/env'

/**
 * Renova a sessão a cada requisição e leva quem não está logado para /entrar.
 * Isto é só conveniência: a segurança de verdade está no RLS e em requireUser().
 */
export async function proxy(request: NextRequest) {
  const env = getSupabaseEnv()
  if (!env) return NextResponse.next()

  let response = NextResponse.next({ request })
  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        list.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const { data } = await supabase.auth.getUser()
  const { pathname, search } = request.nextUrl

  if (!data.user && (pathname === '/app' || pathname.startsWith('/app/'))) {
    const login = request.nextUrl.clone()
    login.pathname = '/entrar'
    login.search = `?next=${encodeURIComponent(pathname + search)}`
    const redirect = NextResponse.redirect(login)
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c))
    return redirect
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
