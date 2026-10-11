/** Endereços que não podem virar o nome de uma loja (rotas do sistema). Mantenha igual ao banco. */
export const RESERVED_SLUGS = [
  'app', 'admin', 'api', 'login', 'cadastro', 'entrar', 'loja', 'colecao', 'produto', 'static', 'assets',
  '_next', 'suporte', 'planos', 'auth', 'recuperar-senha', 'redefinir-senha', 'termos', 'privacidade',
  'perfil', 'robots', 'sitemap', 'convite',
]

/** Mesma regra do banco: 3 a 40 caracteres, letras minúsculas, números e hífen (não nas pontas). */
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/

/** "Boutique Açaí & Cia" → "boutique-acai-cia" */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '')
}

export function slugProblem(slug: string): string | null {
  if (!SLUG_RE.test(slug)) {
    return 'Use de 3 a 40 caracteres: letras minúsculas, números e hífen (sem hífen no começo ou no fim).'
  }
  if (RESERVED_SLUGS.includes(slug)) return 'Este endereço é reservado pelo sistema. Escolha outro.'
  return null
}
