import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** null quando o Supabase ainda não foi configurado (arquivo .env). */
export const supabase = url && anonKey ? createClient(url, anonKey) : null

/**
 * Modo demonstração: libera o gerador sem login. Só para testes;
 * ative com VITE_DEMO_MODE=true e nunca em produção.
 */
export const demoMode = import.meta.env.VITE_DEMO_MODE === 'true'
