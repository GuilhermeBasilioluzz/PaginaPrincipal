// Traduz erros do Supabase/Postgres para mensagens claras. Nunca mostramos o erro bruto.

type SupabaseLikeError = { code?: string; message?: string; status?: number } | null | undefined

const GENERIC = 'Algo deu errado. Tente novamente em instantes.'

export function authErrorMessage(error: SupabaseLikeError): string {
  if (!error) return GENERIC
  switch (error.code) {
    case 'invalid_credentials':
      return 'E-mail ou senha incorretos.'
    case 'email_not_confirmed':
      return 'Confirme seu e-mail pelo link que enviamos antes de entrar.'
    case 'user_already_exists':
    case 'email_exists':
      return 'Já existe uma conta com este e-mail. Tente entrar ou recuperar a senha.'
    case 'weak_password':
      return 'Senha fraca demais. Use pelo menos 8 caracteres, misturando letras e números.'
    case 'same_password':
      return 'A nova senha precisa ser diferente da atual.'
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'
    case 'signup_disabled':
      return 'Novos cadastros estão desativados no momento.'
    default:
      return GENERIC
  }
}

/** Erros vindos das funções e tabelas do banco (Postgres). */
export function dbErrorMessage(error: SupabaseLikeError): string {
  if (!error) return GENERIC
  const message = error.message ?? ''
  if (message.includes('user_not_found')) {
    return 'Não encontramos uma conta com este e-mail. Peça para a pessoa criar uma conta no Hyperion primeiro.'
  }
  if (message.includes('already_member')) return 'Esta pessoa já faz parte da equipe.'
  if (message.includes('below_reserved')) return 'O estoque não pode ficar abaixo do que já está reservado. Conclua ou cancele reservas antes.'
  if (message.includes('insufficient_stock')) return 'Não há estoque suficiente para isso.'
  if (message.includes('depth_exceeded')) return 'Subcategorias não podem ter subcategorias (máximo de 2 níveis).'
  if (message.includes('has_children')) return 'Esta categoria já tem subcategorias, então não pode virar uma subcategoria.'
  if (message.includes('automatic_collection')) return 'A coleção automática monta sozinha; não dá para escolher peças manualmente.'
  if (message.includes('limit_reached')) return 'Cada produto aceita até 8 fotos.'
  if (message.includes('invalid_order')) return 'A ordem das fotos mudou. Atualize a página e tente de novo.'
  if (message.includes('products_sku_uidx')) return 'Já existe um produto com este código (SKU) nesta loja.'
  if (message.includes('not_found')) return 'Este item não existe mais ou você não tem acesso a ele.'
  if (message.includes('ao menos um dono')) return 'A loja precisa ter pelo menos um dono.'
  switch (error.code) {
    case '23505':
      return message.includes('slug') ? 'Este endereço de loja já está em uso. Escolha outro.' : 'Este registro já existe.'
    case '23514':
      return 'Algum dado não é válido. Confira os campos e tente de novo.'
    case '22P02':
    case '22003':
      return 'Algum valor está fora do permitido. Confira preço e quantidade.'
    case '23503':
      return 'Categoria ou coleção inválida para esta loja.'
    case '42501':
      return 'Você não tem permissão para fazer isso.'
    case '28000':
      return 'Sua sessão expirou. Entre novamente.'
    default:
      return GENERIC
  }
}
