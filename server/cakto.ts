import type { AccessRow, PlanId } from '../src/lib/access.js'
import { hasActiveAccess } from '../src/lib/access.js'

/** Dias de acesso liberados a cada pagamento do plano mensal (30 + 3 de tolerância). */
export const MONTHLY_ACCESS_DAYS = 33

/** Formato do aviso (webhook) enviado pela Cakto. Só os campos que usamos. */
export interface CaktoWebhook {
  secret?: string
  event?: string
  data?: {
    id?: string
    refId?: string
    status?: string
    customer?: { email?: string; name?: string }
    product?: { id?: string; short_id?: string; name?: string; type?: string }
    offer?: { id?: string; name?: string }
  }
}

export interface PlanIds {
  lifetime: string[]
  monthly: string[]
}

/** Lê uma lista separada por vírgulas de uma variável de ambiente. */
export function parseIds(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Descobre de qual plano é a compra, comparando os códigos do produto/oferta
 * com os configurados. Se nada bater, assinaturas viram "mensal" e o resto "vitalício".
 */
export function resolvePlan(payload: CaktoWebhook, ids: PlanIds): PlanId {
  const { product, offer } = payload.data ?? {}
  const codes = [product?.id, product?.short_id, offer?.id].filter((c): c is string => Boolean(c))
  const matches = (list: string[]) => codes.some((code) => list.some((id) => code === id || code.startsWith(`${id}_`)))
  if (matches(ids.monthly)) return 'monthly'
  if (matches(ids.lifetime)) return 'lifetime'
  if (payload.event?.startsWith('subscription_') || product?.type?.toLowerCase().includes('subscription')) {
    return 'monthly'
  }
  return 'lifetime'
}

const GRANT_EVENTS = ['purchase_approved', 'subscription_renewed']
const REVOKE_EVENTS = ['refund', 'chargeback']
const CANCEL_EVENTS = ['subscription_canceled']

export type Decision = { action: 'save'; row: AccessRow; reason: string } | { action: 'ignore'; reason: string }

/**
 * Decide como o acesso muda a partir de um evento da Cakto.
 * Função pura (não acessa o banco), para ser fácil de testar.
 */
export function decideAccess(
  current: AccessRow | null,
  event: string,
  plan: PlanId,
  email: string,
  orderId: string | null,
  now = new Date(),
): Decision {
  const lifetimeActive = current?.plan === 'lifetime' && hasActiveAccess(current, now)

  if (GRANT_EVENTS.includes(event)) {
    if (plan === 'lifetime') {
      return {
        action: 'save',
        reason: 'vitalício liberado',
        row: { email, plan, status: 'active', expires_at: null, cakto_order_id: orderId },
      }
    }
    // Um pagamento do mensal nunca rebaixa quem já tem o vitalício.
    if (lifetimeActive) return { action: 'ignore', reason: 'já possui vitalício' }
    const expires = new Date(now.getTime() + MONTHLY_ACCESS_DAYS * 24 * 60 * 60 * 1000)
    return {
      action: 'save',
      reason: 'mensal liberado até ' + expires.toISOString(),
      row: { email, plan, status: 'active', expires_at: expires.toISOString(), cakto_order_id: orderId },
    }
  }

  // Cancelamento e reembolso só afetam o acesso do mesmo plano.
  if (!current || current.plan !== plan) {
    return { action: 'ignore', reason: `evento ${event} sem acesso correspondente` }
  }

  if (CANCEL_EVENTS.includes(event)) {
    // Mantém o acesso até o fim do período já pago.
    return { action: 'save', reason: 'assinatura cancelada', row: { ...current, status: 'canceled' } }
  }

  if (REVOKE_EVENTS.includes(event)) {
    return { action: 'save', reason: `acesso revogado (${event})`, row: { ...current, status: 'revoked' } }
  }

  return { action: 'ignore', reason: `evento ${event} não altera acesso` }
}
