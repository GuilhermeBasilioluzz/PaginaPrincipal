'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/session'
import { readAdjustForm, readReservationForm } from '@/lib/stock'

const UUID = /^[0-9a-f-]{36}$/i

/** Volta para a tela de onde veio (só caminhos internos desta loja) com um código curto de resultado. */
function back(slug: string, fd: FormData, key: 'ok' | 'erro', code: string): never {
  const from = String(fd.get('back') ?? '')
  const safe = from.startsWith(`/app/${slug}/`) && !from.includes('//') && !from.includes('\\') ? from.split('?')[0] : `/app/${slug}/estoque`
  return redirect(`${safe}?${key}=${code}`)
}

function errorCode(error: { code?: string; message?: string }): string {
  const m = error.message ?? ''
  if (m.includes('insufficient_stock')) return 'insufficient'
  if (m.includes('below_reserved')) return 'below_reserved'
  if (m.includes('not_reservable')) return 'not_reservable'
  if (m.includes('already_closed')) return 'closed'
  if (m.includes('invalid_transition')) return 'transition'
  if (m.includes('invalid_expiry')) return 'expiry'
  if (m.includes('invalid_delta') || m.includes('invalid_reason')) return 'invalid'
  if (error.code === '42501') return 'forbidden'
  if (error.code === 'P0002' || m.includes('not_found')) return 'not_found'
  return 'generic'
}

export async function adjustStockAction(slug: string, productId: string, fd: FormData) {
  await requireUser()
  if (!UUID.test(productId)) return back(slug, fd, 'erro', 'invalid')
  const parsed = readAdjustForm(fd)
  if (!parsed.ok) return back(slug, fd, 'erro', 'invalid')
  const supabase = await createClient()
  const { error } = await supabase.rpc('adjust_stock', {
    p_product: productId, p_delta: parsed.delta, p_reason: parsed.op, p_note: parsed.note || null,
  })
  if (error) return back(slug, fd, 'erro', errorCode(error))
  revalidatePath(`/app/${slug}`, 'layout')
  return back(slug, fd, 'ok', 'stock')
}

export async function setStockAction(slug: string, productId: string, fd: FormData) {
  await requireUser()
  const qty = String(fd.get('quantity') ?? '').trim()
  if (!UUID.test(productId) || !/^\d{1,5}$/.test(qty)) return back(slug, fd, 'erro', 'invalid')
  const supabase = await createClient()
  const { error } = await supabase.rpc('set_stock', { p_product: productId, p_quantity: Number(qty), p_note: String(fd.get('note') ?? '').trim().slice(0, 300) || null })
  if (error) return back(slug, fd, 'erro', errorCode(error))
  revalidatePath(`/app/${slug}`, 'layout')
  return back(slug, fd, 'ok', 'stock')
}

export async function createReservationAction(slug: string, fd: FormData) {
  await requireUser()
  const parsed = readReservationForm(fd)
  if (!parsed.ok) return redirect(`/app/${slug}/reservas/nova?erro=invalid&produto=${encodeURIComponent(String(fd.get('product') ?? '').slice(0, 40))}`)
  const p = parsed.payload
  const supabase = await createClient()
  const { error } = await supabase.rpc('create_reservation', {
    p_product: p.product, p_quantity: p.quantity, p_customer: p.customer, p_contact: p.contact || null,
    p_size: p.size || null, p_note: p.note || null, p_expires: p.expires,
  })
  if (error) return redirect(`/app/${slug}/reservas/nova?erro=${errorCode(error)}&produto=${encodeURIComponent(p.product)}`)
  revalidatePath(`/app/${slug}`, 'layout')
  return redirect(`/app/${slug}/reservas?ok=reserved`)
}

export async function setReservationStatusAction(slug: string, reservationId: string, status: 'confirmed' | 'picked_up' | 'cancelled') {
  await requireUser()
  if (!UUID.test(reservationId)) return redirect(`/app/${slug}/reservas?erro=invalid`)
  const supabase = await createClient()
  const { error } = await supabase.rpc('set_reservation_status', { p_reservation: reservationId, p_status: status })
  if (error) return redirect(`/app/${slug}/reservas?erro=${errorCode(error)}`)
  revalidatePath(`/app/${slug}`, 'layout')
  return redirect(`/app/${slug}/reservas?ok=${status}`)
}
