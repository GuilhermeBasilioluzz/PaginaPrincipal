/**
 * Destino depois do login. Só aceita caminhos internos do próprio site,
 * para ninguém usar o link de login para mandar a pessoa a outro domínio.
 */
export function safeNext(value: unknown, fallback = '/app'): string {
  if (typeof value !== 'string') return fallback
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback
  if (/[\u0000-\u001f]/.test(value)) return fallback
  return value
}
