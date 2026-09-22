/**
 * Conferência das variáveis de ambiente. Só lida com nomes e formatos: nunca mostra valores.
 */

/** Chaves de API do Google têm sempre este formato. */
export function isGoogleKey(value: string | undefined): boolean {
  return /^AIza[0-9A-Za-z_-]{35}$/.test(value?.trim() ?? '')
}

const PLACEHOLDERS = ['SEU-PROJETO', 'sua-chave']

/** Problemas na configuração do Supabase do site, em linguagem simples. Lista vazia = tudo certo. */
export function supabaseConfigProblems(url: string | undefined, anonKey: string | undefined): string[] {
  const problems: string[] = []
  const u = url?.trim() ?? ''
  const k = anonKey?.trim() ?? ''
  if (!u) problems.push('VITE_SUPABASE_URL está vazia ou não existe.')
  else if (PLACEHOLDERS.some((p) => u.includes(p))) problems.push('VITE_SUPABASE_URL ainda tem o valor de exemplo.')
  else if (!/^https:\/\/[^\s"']+$/.test(u)) problems.push('VITE_SUPABASE_URL precisa começar com https:// (sem aspas nem espaços).')
  if (!k) problems.push('VITE_SUPABASE_ANON_KEY está vazia ou não existe.')
  else if (PLACEHOLDERS.some((p) => k.includes(p))) problems.push('VITE_SUPABASE_ANON_KEY ainda tem o valor de exemplo.')
  else if (/["'\s]/.test(k)) problems.push('VITE_SUPABASE_ANON_KEY tem aspas ou espaços.')
  return problems
}
