import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Field, SubmitButton } from '@/components/ui'
import { createClient } from '@/lib/supabase/server'
import { getMembership } from '@/lib/session'
import { can } from '@/lib/permissions'
import { STOCK_FLASH } from '@/lib/flash'
import { HOLD_OPTIONS, type StockRow } from '@/lib/stock'
import { createReservationAction } from '../../estoque/actions'

export const metadata = { title: 'Nova reserva' }

export default async function NewReservationPage({ params, searchParams }: {
  params: Promise<{ store: string }>; searchParams: Promise<{ produto?: string; erro?: string; cliente?: string; contato?: string; interesse?: string }>
}) {
  const [{ store: slug }, sp] = await Promise.all([params, searchParams])
  const membership = await getMembership(slug)
  if (!membership) notFound()
  if (!can(membership.role, 'update_stock') || !membership.store.is_active) redirect(`/app/${slug}/reservas?erro=forbidden`)

  const supabase = await createClient()
  const { data } = await supabase.rpc('store_stock_overview', { p_store: membership.store.id, p_filter: 'all', p_q: '', p_limit: 100, p_offset: 0 })
  const products = ((data ?? []) as StockRow[]).filter((p) => !['unavailable', 'archived'].includes(p.status)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  const selected = products.find((p) => p.product_id === sp.produto)
  const sizes = selected ? ((await supabase.from('products').select('sizes').eq('id', selected.product_id).maybeSingle()).data?.sizes ?? []) as string[] : []
  const erro = sp.erro ? STOCK_FLASH[sp.erro] : null
  const interest = sp.interesse && /^[0-9a-f-]{36}$/i.test(sp.interesse) ? sp.interesse : ''
  const prefillName = (sp.cliente ?? '').slice(0, 80)
  const prefillContact = (sp.contato ?? '').replace(/[^\d+() -]/g, '').slice(0, 40)

  return (
    <div className="card narrow">
      <Link href={`/app/${slug}/reservas`} className="link small">← Reservas</Link>
      <h1>Nova reserva</h1>
      {erro && <p className="notice notice-error" role="alert">{erro}</p>}
      {products.length === 0 ? (
        <p className="muted">Cadastre uma peça disponível antes de reservar.</p>
      ) : (
        <form action={createReservationAction.bind(null, slug)} className="stack">
          <label className="field">
            <span className="field-label">Peça</span>
            <select name="product" defaultValue={selected?.product_id ?? ''} required>
              <option value="" disabled>Escolha a peça…</option>
              {products.map((p) => <option key={p.product_id} value={p.product_id}>{p.name} — {Math.max(p.available, 0)} livre(s)</option>)}
            </select>
            <span className="field-hint">Só aparecem peças disponíveis. O número é o que ainda está livre (estoque menos reservas).</span>
          </label>
          <div className="grid-2">
            <Field label="Quantidade" name="quantity" defaultValue="1" inputMode="numeric" required />
            {sizes.length > 0
              ? <label className="field"><span className="field-label">Tamanho</span><select name="size" defaultValue=""><option value="">Qualquer</option>{sizes.map((s) => <option key={s}>{s}</option>)}</select></label>
              : <Field label="Tamanho (opcional)" name="size" maxLength={12} />}
          </div>
          {interest && <input type="hidden" name="interest" value={interest} />}
          <Field label="Nome da cliente" name="customer" required maxLength={80} autoComplete="off" defaultValue={prefillName} />
          <Field label="WhatsApp ou telefone (opcional)" name="contact" maxLength={40} inputMode="tel" autoComplete="off" defaultValue={prefillContact} />
          <label className="field">
            <span className="field-label">Segurar a peça</span>
            <select name="hold" defaultValue="24h">{Object.entries(HOLD_OPTIONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
            <span className="field-hint">Depois do prazo, a peça volta a ficar livre sozinha.</span>
          </label>
          <label className="field"><span className="field-label">Observação (opcional)</span><textarea name="note" rows={2} maxLength={300} /></label>
          <div className="row"><SubmitButton pendingText="Reservando…">Reservar peça</SubmitButton><Link href={`/app/${slug}/reservas`} className="btn btn-ghost">Cancelar</Link></div>
        </form>
      )}
    </div>
  )
}
