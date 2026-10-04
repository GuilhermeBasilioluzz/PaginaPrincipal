/** Variáveis públicas do Supabase. null quando ainda não foram configuradas. */
export function getSupabaseEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+(rest|auth)\/v1.*$/, '').replace(/\/+$/, '')
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!url || !key || !/^https?:\/\//.test(url)) return null
  return { url, key }
}

/** Endereço público do site (links dos e-mails). */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'http://localhost:3000').replace(/\/+$/, '')
}
