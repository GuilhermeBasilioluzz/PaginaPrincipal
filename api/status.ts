import { isGoogleKey } from '../src/lib/config.js'

/**
 * Diagnóstico da configuração do servidor: responde só "configurado ou não", nunca os valores.
 * Abra https://SEU-SITE/api/status para conferir.
 */
export function GET(): Response {
  const has = (name: string) => Boolean(process.env[name]?.trim())
  const supabaseUrl = process.env.SUPABASE_URL?.trim() ?? ''
  return Response.json({
    versao: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local',
    supabase: {
      SUPABASE_URL: supabaseUrl.startsWith('https://') ? 'ok' : has('SUPABASE_URL') ? 'precisa começar com https://' : 'faltando',
      SUPABASE_SERVICE_ROLE_KEY: has('SUPABASE_SERVICE_ROLE_KEY') ? 'ok' : 'faltando',
    },
    cakto: {
      CAKTO_WEBHOOK_SECRET: has('CAKTO_WEBHOOK_SECRET') ? 'ok' : 'faltando (necessário para liberar acessos)',
      CAKTO_LIFETIME_IDS: has('CAKTO_LIFETIME_IDS') ? 'ok' : 'faltando',
      CAKTO_MONTHLY_IDS: has('CAKTO_MONTHLY_IDS') ? 'ok' : 'faltando',
    },
    mapa: isGoogleKey(process.env.GOOGLE_PLACES_API_KEY)
      ? 'Google (GOOGLE_PLACES_API_KEY válida)'
      : has('GOOGLE_PLACES_API_KEY')
        ? 'gratuito (GOOGLE_PLACES_API_KEY preenchida, mas não parece uma chave do Google)'
        : 'gratuito (OpenStreetMap)',
  })
}
