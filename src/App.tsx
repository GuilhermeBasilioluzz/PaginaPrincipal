import { useState } from 'react'
import { getCategory } from './data/categories'
import type { Answers } from './data/types'
import Home from './screens/Home'
import CategorySelect from './screens/CategorySelect'
import Questionnaire from './screens/Questionnaire'
import Result from './screens/Result'

type Screen = 'home' | 'categories' | 'questionnaire' | 'result'

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Answers>({})

  const category = categoryId ? getCategory(categoryId) : undefined

  function chooseCategory(id: string) {
    if (id !== categoryId) setAnswers({})
    setCategoryId(id)
    setScreen('questionnaire')
  }

  function restart() {
    setCategoryId(null)
    setAnswers({})
    setScreen('home')
  }

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={restart}>
          <span aria-hidden>⚡</span> PromptForge
        </button>
      </header>
      <main className="container">
        {screen === 'home' && <Home onStart={() => setScreen('categories')} />}
        {screen === 'categories' && (
          <CategorySelect selectedId={categoryId} onSelect={chooseCategory} onBack={() => setScreen('home')} />
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
          <Result
            category={category}
            answers={answers}
            onEdit={() => setScreen('questionnaire')}
            onRestart={restart}
          />
        )}
      </main>
    </div>
  )
}
