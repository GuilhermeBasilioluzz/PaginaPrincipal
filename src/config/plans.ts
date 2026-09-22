/**
 * Planos e links de pagamento.
 *
 * Para ativar a venda, crie os dois produtos na Cakto (um de pagamento único e
 * uma assinatura mensal) e cole aqui o link de checkout de cada um,
 * por exemplo: 'https://pay.cakto.com.br/abc123'.
 * Enquanto o link estiver vazio, o botão aparece como "Pagamento em breve".
 */
export interface Plan {
  id: 'lifetime' | 'monthly'
  name: string
  /** Preço em reais. */
  price: number
  /** Preço "de" riscado, quando houver promoção. */
  originalPrice?: number
  period: string
  checkoutUrl: string
  cta: string
  features: string[]
}

export const lifetimePlan: Plan = {
  id: 'lifetime',
  name: 'Vitalício',
  price: 249,
  originalPrice: 499,
  period: 'pagamento único',
  checkoutUrl: 'https://pay.cakto.com.br/ubgv3n5',
  cta: 'Garantir acesso vitalício',
  features: [
    'Acesso para sempre, sem mensalidade',
    'Todas as categorias e questionários',
    'Projetos ilimitados',
    'Novas categorias e melhorias incluídas',
  ],
}

export const monthlyPlan: Plan = {
  id: 'monthly',
  name: 'Mensal',
  price: 99,
  period: 'por mês',
  checkoutUrl: 'https://pay.cakto.com.br/pehqx45_1129830',
  cta: 'Assinar plano mensal',
  features: [
    'Todas as categorias e questionários',
    'Projetos ilimitados',
    'Novas categorias e melhorias incluídas',
    'Cancele quando quiser',
  ],
}

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
