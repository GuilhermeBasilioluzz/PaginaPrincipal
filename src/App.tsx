import { useEffect, useState } from 'react'
import { useAccess } from './auth/useAccess'
import { getCategory } from './data/categories'
import { configProblems } from './lib/supabase'
import type { Answers } from './data/types'
import Landing from './screens/Landing'
import Terms from './legal/Terms'
import Privacy from './legal/Privacy'
import Login from './screens/Login'
import NoAccess from './screens/NoAccess'
import CategorySelect from './screens/CategorySelect'
import Questionnaire from './screens/Questionnaire'
import Result from './screens/Result'
import Prospect from './screens/Prospect'
import Contacts from './screens/Contacts'
import { useSavedLeads } from './crm/useSavedLeads'
import type { Niche } from './data/niches'
import { answersFromLead, type PlaceInfo } from './lib/leads'

type Screen = 'landing' | 'prospect' | 'contacts' | 'categories' | 'questionnaire' | 'result' | 'terms' | 'privacy'
export type LegalPage = 'terms' | 'privacy'

/** Endereços diretos das páginas legais: /#termos e /#privacidade. */
const legalHash: Record<LegalPage, string> = { terms: '#termos', privacy: '#privacidade' }

// Link de retorno para usar na Cakto após a compra: https://SEU-SITE/#entrar
const initialHash = typeof window !== 'undefined' ? window.location.hash : ''
const startsInApp = initialHash === '#entrar'
const startsOnLegal = (Object.keys(legalHash) as LegalPage[]).find((k) => legalHash[k] === initialHash)

export default function App() {
  const { state, refresh, signOut } = useAccess()
  const [screen, setScreen] = useState<Screen>(startsOnLegal ?? (startsInApp ? 'prospect' : 'landing'))
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Answers>({})

  const category = categoryId ? getCategory(categoryId) : undefined
  const canUse = state.status === 'active' || state.status === 'demo'
  const crm = useSavedLeads(canUse)
  const email = state.status === 'active' || state.status === 'no-access' ? state.email : null

  // 'instant' ignora a rolagem suave da página, para cada tela começar sempre do topo.
  useEffect(() => window.scrollTo({ top: 0, behavior: 'instant' }), [screen])

  function chooseCategory(id: string) {
    if (id !== categoryId) setAnswers({})
    setCategoryId(id)
    setScreen('questionnaire')
  }

  function createFromLead(lead: PlaceInfo, niche: Niche) {
    setCategoryId(niche.categoryId)
    setAnswers(answersFromLead(lead, niche))
    setScreen('questionnaire')
  }

  function openLegal(page: LegalPage) {
    history.replaceState(null, '', legalHash[page])
    setScreen(page)
  }

  function goHome() {
    if (window.location.hash) history.replaceState(null, '', window.location.pathname)
    setScreen('landing')
  }

  function restart() {
    setCategoryId(null)
    setAnswers({})
    setScreen('categories')
  }

  const onLanding = screen === 'landing'

  function renderApp() {
    switch (state.status) {
      case 'loading':
        return <p className="muted center-text">Carregando…</p>
      case 'unconfigured':
        return (
          <div className="card config-problems">
            <p>
              <strong>O login ainda não foi configurado neste site.</strong>
            </p>
            <p className="muted">Para quem administra o site: confira na Vercel (Settings → Environment Variables):</p>
            <ul>
              {configProblems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <p className="muted small">
              Depois de corrigir, publique de novo em Deployments → ⋯ → Redeploy. As variáveis que começam com VITE_ só
              entram no site numa nova publicação.
            </p>
          </div>
        )
      case 'signed-out':
        return <Login onBack={goHome} onOpenLegal={openLegal} />
      case 'no-access':
        return <NoAccess email={state.email} access={state.access} onRefresh={refresh} onSignOut={signOut} />
    }
    return (
      <>
        {state.status === 'demo' && (
          <p className="demo-banner">Modo demonstração: o login e o pagamento estão desativados nesta prévia.</p>
        )}
        <nav className="app-tabs" aria-label="Seções">
          <button className={screen === 'prospect' ? 'active' : ''} onClick={() => setScreen('prospect')}>
            Prospectar clientes
          </button>
          <button className={screen === 'contacts' ? 'active' : ''} onClick={() => setScreen('contacts')}>
            Meus contatos{crm.rows.length > 0 && <span className="tab-count">{crm.rows.length}</span>}
          </button>
          <button
            className={screen !== 'prospect' && screen !== 'contacts' ? 'active' : ''}
            onClick={() => setScreen('categories')}
          >
            Criar projeto
          </button>
        </nav>
        {/* A prospecção continua montada (escondida) para não perder o mapa e a lista ao criar um projeto. */}
        <div hidden={screen !== 'prospect'}>
          <Prospect crm={crm} onCreateProject={createFromLead} />
        </div>
        {screen === 'contacts' && (
          <Contacts crm={crm} onProspect={() => setScreen('prospect')} onCreateProject={createFromLead} />
        )}
        {screen === 'categories' && <CategorySelect selectedId={categoryId} onSelect={chooseCategory} onBack={goHome} />}
        {screen === 'questionnaire' && category && (
          <Questionnaire
            category={category}
            answers={answers}
            onChange={setAnswers}
            onBack={() => setScreen('categories')}
            onFinish={() => setScreen('result')}
          />
        )}
        {screen === 'result' && category && (
          <Result category={category} answers={answers} onEdit={() => setScreen('questionnaire')} onRestart={restart} />
        )}
      </>
    )
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="wrap topbar-row">
          <button className="logo" onClick={goHome}>
            Prompt<span>Forge</span>
          </button>
          <nav className="nav">
            {onLanding && (
              <>
                <a href="#prospeccao">Prospecção</a>
                <a href="#como-funciona">Como funciona</a>
                <a href="#precos">Preços</a>
              </>
            )}
            {!onLanding && email && (
              <span className="nav-user" title={email}>
                {email}
              </span>
            )}
            {!onLanding && email && (
              <button className="link" onClick={signOut}>
                Sair
              </button>
            )}
            {onLanding && (
              <button className="btn btn-small btn-outline" onClick={() => setScreen('prospect')}>
                {canUse ? 'Abrir sistema' : 'Entrar'}
              </button>
            )}
          </nav>
        </div>
      </header>

      {onLanding ? (
        <Landing onOpenGenerator={() => setScreen('prospect')} onOpenLegal={openLegal} />
      ) : screen === 'terms' || screen === 'privacy' ? (
        <main className="wrap legal">
          <button className="link" onClick={goHome}>
            ← Página inicial
          </button>
          {screen === 'terms' ? <Terms /> : <Privacy />}
          <p className="muted small">
            Veja também:{' '}
            <button className="link" onClick={() => openLegal(screen === 'terms' ? 'privacy' : 'terms')}>
              {screen === 'terms' ? 'Política de Privacidade' : 'Termos de Uso'}
            </button>
          </p>
        </main>
      ) : (
        <main className="wrap generator">{renderApp()}</main>
      )}
    </div>
  )
}
