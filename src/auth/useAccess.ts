import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { hasActiveAccess, type AccessRow } from '../lib/access'
import { demoMode, supabase } from '../lib/supabase'

export type AccessState =
  | { status: 'loading' }
  | { status: 'demo' }
  | { status: 'unconfigured' }
  | { status: 'signed-out' }
  | { status: 'no-access'; email: string; access: AccessRow | null }
  | { status: 'active'; email: string; access: AccessRow }

/** Sessão do usuário + se ele tem acesso pago ao gerador. */
export function useAccess() {
  // undefined = sessão ainda carregando.
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [state, setState] = useState<AccessState>(() =>
    demoMode ? { status: 'demo' } : supabase ? { status: 'loading' } : { status: 'unconfigured' },
  )

  useEffect(() => {
    if (demoMode || !supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const refresh = useCallback(async () => {
    if (demoMode || !supabase || session === undefined) return
    const email = session?.user.email?.toLowerCase()
    if (!email) {
      setState({ status: 'signed-out' })
      return
    }
    setState({ status: 'loading' })
    const { data } = await supabase.from('access').select('*').eq('email', email).maybeSingle<AccessRow>()
    setState(hasActiveAccess(data) ? { status: 'active', email, access: data! } : { status: 'no-access', email, access: data })
  }, [session])

  useEffect(() => {
    refresh()
  }, [refresh])

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut()
  }, [])

  return { state, refresh, signOut }
}
