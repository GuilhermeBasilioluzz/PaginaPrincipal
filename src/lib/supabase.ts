import { createClient } from '@supabase/supabase-js'
import { supabaseConfigProblems } from './config'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** O que está errado nas variáveis do Supabase (vazio quando está tudo certo). */
export const configProblems = supabaseConfigProblems(url, anonKey)

/** null quando o Supabase ainda não foi configurado corretamente. */
export const supabase = configProblems.length === 0 ? createClient(url!.trim(), anonKey!.trim()) : null

/**
 * Modo demonstração: libera o gerador sem login. Só para testes;
 * ative com VITE_DEMO_MODE=true e nunca em produção.
 */
export const demoMode = import.meta.env.VITE_DEMO_MODE === 'true'
