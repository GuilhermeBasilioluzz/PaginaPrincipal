export const dynamic = 'force-dynamic' // depende da sessão: nunca pré-renderizar

import Link from 'next/link'
import { Brand } from '@/components/Brand'
import { ConfigNotice } from '@/components/ConfigNotice'
import { getProfile } from '@/lib/session'
import { getSupabaseEnv } from '@/lib/supabase/env'
import { signOutAction } from '../../(auth)/actions'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!getSupabaseEnv()) return <main className="auth"><ConfigNotice /></main>
  const profile = await getProfile()

  return (
    <div className="shell">
      <header className="topbar">
        <Brand href="/app" />
        <nav className="topnav" aria-label="Conta">
          <Link href="/app/perfil" className="link" title={profile.email}>{profile.fullName || profile.email}</Link>
          <form action={signOutAction}><button className="link" type="submit">Sair</button></form>
        </nav>
      </header>
      <div className="content">{children}</div>
    </div>
  )
}
