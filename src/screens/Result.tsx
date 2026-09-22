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
    a.download = 'projeto.md'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section>
      <p className="eyebrow">Passo 3 de 3</p>
      <h2 className="screen-title">Seu projeto está pronto</h2>
      <p className="muted">Copie ou baixe o projeto e use como guia para construir o seu sistema.</p>
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
            {copied ? 'Copiado!' : 'Copiar projeto'}
          </button>
        </div>
      </div>
      <button className="link center" onClick={onRestart}>
        Criar outro projeto
      </button>
    </section>
  )
}
