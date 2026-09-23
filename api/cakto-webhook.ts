import { timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { AccessRow } from '../src/lib/access.js'
import { decideAccess, minimalPayload, parseIds, resolvePlan, type CaktoWebhook } from '../server/cakto.js'
import { normalizeSupabaseUrl } from '../src/lib/config.js'

/**
 * Recebe os avisos da Cakto (webhook) e libera ou remove o acesso ao gerador.
 * Endereço depois de publicado: https://SEU-SITE/api/cakto-webhook
 */

function json(status: number, body: unknown): Response {
  return Response.json(body, { status })
}

function sameSecret(received: string, expected: string): boolean {
  const a = Buffer.from(received)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: Request): Promise<Response> {
  const { CAKTO_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
  if (!CAKTO_WEBHOOK_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Webhook sem configuração: defina CAKTO_WEBHOOK_SECRET, SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY')
    return json(500, { error: 'servidor não configurado' })
  }

  let payload: CaktoWebhook
  try {
    payload = await request.json()
  } catch {
    return json(400, { error: 'corpo inválido' })
  }

  // A Cakto envia a chave secreta dentro do corpo do aviso.
  if (typeof payload.secret !== 'string' || !sameSecret(payload.secret, CAKTO_WEBHOOK_SECRET)) {
    return json(401, { error: 'chave secreta inválida' })
  }

  const event = payload.event ?? ''
  const email = payload.data?.customer?.email?.trim().toLowerCase() ?? ''
  const orderId = payload.data?.refId ?? payload.data?.id ?? null

  const db = createClient(normalizeSupabaseUrl(SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY.trim(), { auth: { persistSession: false } })
  // Guarda só o necessário para conferência: sem a chave secreta e sem dados pessoais além do e-mail.
  const logged = minimalPayload(payload)
  const log = (result: string) =>
    db.from('webhook_events').insert({ event, email, order_id: orderId, result, payload: logged })

  if (!email) {
    await log('ignorado: sem e-mail do cliente')
    return json(200, { ok: true, ignored: 'sem e-mail' })
  }

  const plan = resolvePlan(payload, {
    lifetime: parseIds(process.env.CAKTO_LIFETIME_IDS),
    monthly: parseIds(process.env.CAKTO_MONTHLY_IDS),
  })

  const { data: current, error: readError } = await db.from('access').select('*').eq('email', email).maybeSingle<AccessRow>()
  if (readError) {
    console.error('Erro ao ler acesso', readError)
    return json(500, { error: 'erro no banco' }) // a Cakto tenta de novo
  }

  const decision = decideAccess(current, event, plan, email, orderId)
  if (decision.action === 'save') {
    const { error } = await db.from('access').upsert({ ...decision.row, updated_at: new Date().toISOString() })
    if (error) {
      console.error('Erro ao salvar acesso', error)
      return json(500, { error: 'erro no banco' })
    }
  }

  await log(`${plan}: ${decision.reason}`)
  return json(200, { ok: true, plan, result: decision.reason })
}
