import { useEffect, useState } from 'react'
import { getCategory } from './data/categories'
import type { Answers } from './data/types'
import Landing from './screens/Landing'
import CategorySelect from './screens/CategorySelect'
import Questionnaire from './screens/Questionnaire'
import Result from './screens/Result'

type Screen = 'landing' | 'categories' | 'questionnaire' | 'result'

export default function App() {
  const [screen, setScreen] = useState<Screen>('landing')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Answers>({})

  const category = categoryId ? getCategory(categoryId) : undefined

  useEffect(() => window.scrollTo(0, 0), [screen])

  function chooseCategory(id: string) {
    if (id !== categoryId) setAnswers({})
    setCategoryId(id)
    setScreen('questionnaire')
  }

  function goHome() {
    setCategoryId(null)
    setAnswers({})
    setScreen('landing')
  }

  function restart() {
    setCategoryId(null)
    setAnswers({})
    setScreen('categories')
  }

  const onLanding = screen === 'landing'

  return (
    <div className="app">
      <header className="topbar">
        <div className="wrap topbar-row">
          <button className="logo" onClick={goHome}>
            Prompt<span>Forge</span>
          </button>
          {onLanding ? (
            <nav className="nav">
              <a href="#como-funciona">Como funciona</a>
              <a href="#categorias">Categorias</a>
              <a href="#precos">Preços</a>
              <button className="btn btn-small btn-outline" onClick={() => setScreen('categories')}>
                Abrir gerador
              </button>
            </nav>
          ) : (
            <button className="link" onClick={goHome}>
              Página inicial
            </button>
          )}
        </div>
      </header>

      {onLanding ? (
        <Landing onOpenGenerator={() => setScreen('categories')} />
      ) : (
        <main className="wrap generator">
          {screen === 'categories' && (
            <CategorySelect selectedId={categoryId} onSelect={chooseCategory} onBack={goHome} />
          )}
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
        </main>
      )}
    </div>
  )
}
