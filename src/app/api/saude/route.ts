import { NextResponse } from 'next/server'
import { createPublicClient } from '@/lib/supabase/public'
import { aiConfigured } from '@/lib/ai'
import { getSupabaseEnv, siteUrl } from '@/lib/supabase/env'

export const dynamic = 'force-dynamic'

/** Diagnóstico de configuração para quem está publicando: só diz "sim/não", nunca mostra chaves nem dados. */
export async function GET() {
  const env = !!getSupabaseEnv()
  let database: 'ok' | 'sem_migrations' | 'sem_conexao' | 'nao_configurado' = 'nao_configurado'
  if (env) {
    const supabase = createPublicClient()
    const { error } = supabase ? await supabase.rpc('catalog_store', { p_slug: 'saude-check' }) : { error: { message: 'x' } }
    database = !supabase ? 'sem_conexao' : !error ? 'ok' : /function|schema cache|does not exist|PGRST20/i.test(error.message ?? '') ? 'sem_migrations' : 'sem_conexao'
  }
  return NextResponse.json(
    { supabase_configurado: env, banco: database, ia_ligada: aiConfigured(), endereco_do_site: siteUrl() },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  )
}
