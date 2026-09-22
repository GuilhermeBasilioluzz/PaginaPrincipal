import { beforeEach, describe, expect, it, vi } from 'vitest'

// Banco de dados falso em memória no lugar do Supabase.
const db = { access: new Map<string, Record<string, unknown>>(), events: [] as Record<string, unknown>[] }

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => ({
      insert: async (row: Record<string, unknown>) => {
        db.events.push(row)
        return { error: null }
      },
      upsert: async (row: Record<string, unknown>) => {
        db.access.set(row.email as string, row)
        return { error: null }
      },
      select: () => ({
        eq: (_col: string, email: string) => ({
          maybeSingle: async () => ({ data: table === 'access' ? (db.access.get(email) ?? null) : null, error: null }),
        }),
      }),
    }),
  }),
}))

const { POST } = await import('../api/cakto-webhook')

function send(body: unknown) {
  return POST(new Request('http://localhost/api/cakto-webhook', { method: 'POST', body: JSON.stringify(body) }))
}

beforeEach(() => {
  db.access.clear()
  db.events.length = 0
  process.env.CAKTO_WEBHOOK_SECRET = 'segredo-teste'
  process.env.SUPABASE_URL = 'https://exemplo.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
  process.env.CAKTO_LIFETIME_IDS = 'ubgv3n5'
  process.env.CAKTO_MONTHLY_IDS = 'pehqx45'
})

describe('POST /api/cakto-webhook', () => {
  it('recusa aviso com chave secreta errada', async () => {
    const res = await send({ secret: 'errado', event: 'purchase_approved', data: {} })
    expect(res.status).toBe(401)
    expect(db.access.size).toBe(0)
  })

  it('libera o vitalício numa compra aprovada, sem guardar a chave no registro', async () => {
    const res = await send({
      secret: 'segredo-teste',
      event: 'purchase_approved',
      data: { id: 'pedido1', customer: { email: ' Cliente@Exemplo.com ' }, offer: { id: 'ubgv3n5' } },
    })
    expect(res.status).toBe(200)
    expect(db.access.get('cliente@exemplo.com')).toMatchObject({ plan: 'lifetime', status: 'active', expires_at: null })
    expect(JSON.stringify(db.events)).not.toContain('segredo-teste')
  })

  it('remove o acesso após reembolso', async () => {
    const base = { secret: 'segredo-teste', data: { customer: { email: 'a@b.com' }, offer: { id: 'pehqx45_1129830' } } }
    await send({ ...base, event: 'purchase_approved' })
    expect(db.access.get('a@b.com')).toMatchObject({ plan: 'monthly', status: 'active' })
    await send({ ...base, event: 'refund' })
    expect(db.access.get('a@b.com')).toMatchObject({ status: 'revoked' })
  })
})
