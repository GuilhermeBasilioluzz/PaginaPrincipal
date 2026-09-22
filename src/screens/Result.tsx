import { useMemo, useRef, useState } from 'react'
import type { Answers, Category } from '../data/types'
import { generatePrompt } from '../lib/generatePrompt'

interface Props {
  category: Category
  answers: Answers
  onEdit: () => void
  onRestart: () => void
}

export default function Result({ category, answers, onEdit, onRestart }: Props) {
  const prompt = useMemo(() => generatePrompt(category, answers), [category, answers])
  const [copied, setCopied] = useState(false)
  const promptRef = useRef<HTMLPreElement>(null)

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Sem acesso à área de transferência: seleciona o texto para a pessoa copiar manualmente.
      if (promptRef.current) window.getSelection()?.selectAllChildren(promptRef.current)
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([prompt], { type: 'text/markdown' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'prompt.md'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section>
      <h2>Seu prompt está pronto ✨</h2>
      <p className="muted">Copie e cole no assistente de IA de sua preferência.</p>
      <pre ref={promptRef} className="card prompt">{prompt}</pre>
      <div className="actions">
        <button className="btn" onClick={onEdit}>
          Editar respostas
        </button>
        <div className="actions-right">
          <button className="btn" onClick={download}>
            Baixar .md
          </button>
          <button className="btn primary" onClick={copy}>
            {copied ? 'Copiado!' : 'Copiar prompt'}
          </button>
        </div>
      </div>
      <button className="link center" onClick={onRestart}>
        Criar outro prompt
      </button>
    </section>
  )
}
