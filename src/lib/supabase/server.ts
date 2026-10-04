import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabaseEnv } from './env'

/** Cliente do Supabase para o servidor, com a sessão da pessoa logada (respeita o RLS). */
export async function createClient() {
  const env = getSupabaseEnv()
  if (!env) throw new Error('Supabase não configurado')
  const cookieStore = await cookies()

  return createServerClient(env.url, env.key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(list) {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Chamado de um Server Component: o proxy já renova a sessão, pode ignorar.
        }
      },
    },
  })
}
