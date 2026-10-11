/** Variáveis públicas do Supabase. null quando ainda não foram configuradas. */
export function getSupabaseEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+(rest|auth)\/v1.*$/, '').replace(/\/+$/, '')
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!url || !key || !/^https?:\/\//.test(url)) return null
  return { url, key }
}

/**
 * Endereço público do site (links dos e-mails, prévias do WhatsApp). Ordem: NEXT_PUBLIC_SITE_URL, o endereço que a Vercel
 * informa sozinha e, por último, o computador local. Assim o primeiro teste na Vercel funciona sem configurar isto.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (explicit) return explicit.replace(/\/+$/, '')
  const vercel = (process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '')
  return vercel ? `https://${vercel}` : 'http://localhost:3000'
}
