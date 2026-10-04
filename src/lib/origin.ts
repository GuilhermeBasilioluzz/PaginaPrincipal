import { siteUrl } from './supabase/env'

/** Endereço usado nos links dos e-mails. Vem da configuração, nunca de cabeçalhos da requisição. */
export const callbackUrl = (next = '/app') => `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}`
