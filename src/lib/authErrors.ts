/** Erro devolvido pelo Supabase Auth (só os campos que usamos). */
export interface AuthErrorLike {
  message?: string
  status?: number
  code?: string
}

/**
 * Traduz o erro do envio do e-mail de login em uma explicação útil.
 * Não contém dados sensíveis: só o motivo e onde corrigir.
 */
export function explainSendError(error: AuthErrorLike): string {
  const msg = (error.message ?? '').toLowerCase()
  const code = (error.code ?? '').toLowerCase()

  if (error.status === 429 || msg.includes('rate limit') || code.includes('rate_limit')) {
    return 'Muitos e-mails de acesso enviados em pouco tempo. O envio gratuito do Supabase tem limite por hora: espere um pouco e tente de novo.'
  }
  if (msg.includes('invalid api key') || msg.includes('no api key') || code === 'bad_jwt' || error.status === 401) {
    return 'O site não foi aceito pelo Supabase: a chave pública (VITE_SUPABASE_ANON_KEY) na Vercel está errada.'
  }
  if (msg.includes('signups not allowed') || code === 'signup_disabled') {
    return 'O cadastro de novos usuários está desligado no Supabase (Authentication → Sign In / Providers → "Allow new users to sign up").'
  }
  if (msg.includes('email logins are disabled') || msg.includes('provider is not enabled') || code === 'email_provider_disabled') {
    return 'O login por e-mail está desligado no Supabase (Authentication → Sign In / Providers → Email).'
  }
  if (msg.includes('invalid') && msg.includes('email')) {
    return 'Esse endereço de e-mail não foi aceito. Confira se está digitado certo.'
  }
  if (msg.includes('sending') || msg.includes('smtp') || error.status === 500) {
    return 'O Supabase não conseguiu enviar o e-mail. Confira em Authentication → Emails (SMTP) no Supabase e tente de novo.'
  }
  if (msg.includes('fetch') || msg.includes('network') || error.status === 0) {
    return 'Não foi possível falar com o Supabase. Confira o endereço em VITE_SUPABASE_URL na Vercel.'
  }
  return 'Não foi possível enviar o e-mail. Tente de novo em alguns minutos.'
}
