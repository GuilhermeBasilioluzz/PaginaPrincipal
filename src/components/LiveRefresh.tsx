'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase/browser'
import { createDebounced } from '@/lib/stock'

type Status = 'connecting' | 'live' | 'offline'

/**
 * Deixa a tela "ao vivo": escuta o estoque, as reservas e o histórico da loja (Supabase Realtime, que respeita o RLS)
 * e pede os dados novos ao servidor quando algo muda. Se a conexão cair, atualiza sozinho a cada 20 s e ao voltar à aba.
 */
export function LiveRefresh({ storeId }: { storeId: string }) {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('connecting')
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const statusRef = useRef<Status>('connecting')

  useEffect(() => {
    const refresh = createDebounced(() => { router.refresh(); setUpdatedAt(new Date()) }, 350)
    const supabase = createBrowserSupabase()
    const set = (s: Status) => { statusRef.current = s; setStatus(s) }

    const channel = supabase.channel(`stock:${storeId}`)
    for (const table of ['inventory', 'reservations', 'inventory_movements']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `store_id=eq.${storeId}` }, () => refresh.call())
    }
    channel.subscribe((s) => {
      if (s === 'SUBSCRIBED') set('live')
      else if (s === 'CLOSED' || s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') set('offline')
    })

    // plano B: sem conexão em tempo real, atualiza de tempos em tempos
    const poll = setInterval(() => { if (statusRef.current !== 'live' && !document.hidden) refresh.call() }, 20_000)
    const onVisible = () => { if (!document.hidden) refresh.call() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      refresh.cancel()
      clearInterval(poll)
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(channel)
    }
  }, [storeId, router])

  const label = status === 'live' ? 'Ao vivo' : status === 'connecting' ? 'Conectando…' : 'Reconectando… (atualizando a cada 20 s)'
  return (
    <p className={`live live-${status}`} role="status" aria-live="polite">
      <span className="live-dot" aria-hidden="true" /> {label}
      {updatedAt && <span className="muted small"> · atualizado às {updatedAt.toLocaleTimeString('pt-BR')}</span>}
    </p>
  )
}
