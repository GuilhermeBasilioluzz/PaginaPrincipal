export const dynamic = 'force-dynamic' // depende da sessão: nunca pré-renderizar

import { Brand } from '@/components/Brand'
import { ConfigNotice } from '@/components/ConfigNotice'
import { getSupabaseEnv } from '@/lib/supabase/env'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth">
      <Brand />
      <div className="card auth-card">{getSupabaseEnv() ? children : <ConfigNotice />}</div>
    </main>
  )
}
