import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { hasActiveAccess, type AccessRow } from '../src/lib/access.js'
import { normalizeSupabaseUrl } from '../src/lib/config.js'

export function serviceClient(): SupabaseClient | null {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null
  return createClient(normalizeSupabaseUrl(SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY.trim(), { auth: { persistSession: false } })
}

/**
 * Confere o login (token do Supabase no cabeçalho Authorization) e se o acesso pago está ativo.
 * Devolve o e-mail do usuário, ou a resposta de erro a ser enviada.
 */
export async function requireAccess(request: Request): Promise<{ email: string } | { error: Response }> {
  const db = serviceClient()
  if (!db) return { error: Response.json({ error: 'servidor não configurado' }, { status: 500 }) }

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return { error: Response.json({ error: 'faça login' }, { status: 401 }) }

  const { data: userData, error: userError } = await db.auth.getUser(token)
  const email = userData.user?.email?.toLowerCase()
  if (userError || !email) return { error: Response.json({ error: 'sessão inválida' }, { status: 401 }) }

  const { data: access } = await db.from('access').select('*').eq('email', email).maybeSingle<AccessRow>()
  if (!hasActiveAccess(access)) return { error: Response.json({ error: 'acesso não liberado' }, { status: 403 }) }

  return { email }
}
