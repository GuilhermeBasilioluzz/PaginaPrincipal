export type PlanId = 'lifetime' | 'monthly'
export type AccessStatus = 'active' | 'canceled' | 'revoked'

/** Uma linha da tabela `access` do Supabase. */
export interface AccessRow {
  email: string
  plan: PlanId
  status: AccessStatus
  expires_at: string | null
  cakto_order_id: string | null
}

/**
 * O acesso vale enquanto não for revogado (reembolso/chargeback) e não tiver expirado.
 * Uma assinatura cancelada continua valendo até o fim do período já pago.
 */
export function hasActiveAccess(row: AccessRow | null, now = new Date()): boolean {
  if (!row || row.status === 'revoked') return false
  return row.expires_at === null || new Date(row.expires_at) > now
}
