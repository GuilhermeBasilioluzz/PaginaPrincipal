import { createClient } from '@supabase/supabase-js'
import { getSupabaseEnv } from './env'

/**
 * Cliente SEM sessão de usuário: sempre age como visitante (papel "anon"). O catálogo público usa só este,
 * mesmo que a pessoa esteja logada, para ela ver exatamente o que uma cliente vê.
 */
export function createPublicClient() {
  const env = getSupabaseEnv()
  if (!env) return null
  return createClient(env.url, env.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
}
