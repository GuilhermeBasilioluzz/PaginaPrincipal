import { createBrowserClient } from '@supabase/ssr'

/** Cliente do navegador, usado só para enviar arquivos ao Storage com a sessão da pessoa logada. */
export function createBrowserSupabase() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}
