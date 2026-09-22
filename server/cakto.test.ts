import { describe, expect, it } from 'vitest'
import { hasActiveAccess, type AccessRow } from '../src/lib/access'
import { decideAccess, MONTHLY_ACCESS_DAYS, parseIds, resolvePlan } from './cakto'

const now = new Date('2026-09-22T12:00:00Z')
const email = 'cliente@exemplo.com'
const ids = { lifetime: ['ubgv3n5'], monthly: ['pehqx45'] }

function row(partial: Partial<AccessRow>): AccessRow {
  return { email, plan: 'monthly', status: 'active', expires_at: null, cakto_order_id: 'x', ...partial }
}

describe('resolvePlan', () => {
  it('reconhece o plano pelo código da oferta ou do produto', () => {
    expect(resolvePlan({ event: 'purchase_approved', data: { offer: { id: 'ubgv3n5' } } }, ids)).toBe('lifetime')
    expect(resolvePlan({ event: 'purchase_approved', data: { product: { short_id: 'pehqx45' } } }, ids)).toBe('monthly')
    expect(resolvePlan({ event: 'purchase_approved', data: { offer: { id: 'pehqx45_1129830' } } }, ids)).toBe('monthly')
  })

  it('sem código configurado, assinatura vira mensal e o resto vitalício', () => {
    const none = { lifetime: [], monthly: [] }
    expect(resolvePlan({ event: 'subscription_renewed', data: {} }, none)).toBe('monthly')
    expect(resolvePlan({ event: 'purchase_approved', data: { product: { type: 'subscription' } } }, none)).toBe('monthly')
    expect(resolvePlan({ event: 'purchase_approved', data: { product: { type: 'unique' } } }, none)).toBe('lifetime')
  })

  it('lê listas de códigos separadas por vírgula', () => {
    expect(parseIds(' a, b ,,c')).toEqual(['a', 'b', 'c'])
    expect(parseIds(undefined)).toEqual([])
  })
})

describe('decideAccess', () => {
  it('libera o vitalício sem data de expiração', () => {
    const d = decideAccess(null, 'purchase_approved', 'lifetime', email, 'o1', now)
    expect(d.action).toBe('save')
    if (d.action === 'save') expect(d.row).toMatchObject({ plan: 'lifetime', status: 'active', expires_at: null })
  })

  it('libera o mensal por um período e renova a cada pagamento', () => {
    const d = decideAccess(null, 'purchase_approved', 'monthly', email, 'o1', now)
    if (d.action !== 'save') throw new Error('esperava liberar')
    const days = (new Date(d.row.expires_at!).getTime() - now.getTime()) / 86_400_000
    expect(days).toBe(MONTHLY_ACCESS_DAYS)

    const later = new Date(now.getTime() + 30 * 86_400_000)
    const renewed = decideAccess(d.row, 'subscription_renewed', 'monthly', email, 'o2', later)
    if (renewed.action !== 'save') throw new Error('esperava renovar')
    expect(new Date(renewed.row.expires_at!) > new Date(d.row.expires_at!)).toBe(true)
  })

  it('não rebaixa quem já tem o vitalício', () => {
    const d = decideAccess(row({ plan: 'lifetime' }), 'purchase_approved', 'monthly', email, 'o2', now)
    expect(d.action).toBe('ignore')
  })

  it('cancelamento mantém o acesso até o fim do período pago', () => {
    const expires = new Date(now.getTime() + 10 * 86_400_000).toISOString()
    const d = decideAccess(row({ expires_at: expires }), 'subscription_canceled', 'monthly', email, null, now)
    if (d.action !== 'save') throw new Error('esperava salvar')
    expect(d.row.status).toBe('canceled')
    expect(hasActiveAccess(d.row, now)).toBe(true)
    expect(hasActiveAccess(d.row, new Date(now.getTime() + 11 * 86_400_000))).toBe(false)
  })

  it('reembolso e chargeback removem o acesso na hora', () => {
    for (const event of ['refund', 'chargeback']) {
      const d = decideAccess(row({ plan: 'lifetime' }), event, 'lifetime', email, null, now)
      if (d.action !== 'save') throw new Error('esperava revogar')
      expect(hasActiveAccess(d.row, now)).toBe(false)
    }
  })

  it('reembolso do mensal não tira o vitalício', () => {
    expect(decideAccess(row({ plan: 'lifetime' }), 'refund', 'monthly', email, null, now).action).toBe('ignore')
  })

  it('ignora eventos que não mexem no acesso', () => {
    expect(decideAccess(null, 'pix_gerado', 'lifetime', email, null, now).action).toBe('ignore')
    expect(decideAccess(null, 'refund', 'lifetime', email, null, now).action).toBe('ignore')
  })
})
