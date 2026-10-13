'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteStoryAction, discardStoryAction, restoreStoryAction } from '@/app/(app)/app/[store]/stories/actions'

export function StoryActions({ slug, id, status, canDelete }: { slug: string; id: string; status: 'pending' | 'converted' | 'discarded'; canDelete: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const run = (fn: () => Promise<{ error?: string }>) => start(async () => { const r = await fn(); setError(r.error ?? null); router.refresh() })
  return (
    <div className="stack">
      <div className="row">
        {status === 'pending' && <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => run(() => discardStoryAction(slug, id))}>Descartar</button>}
        {status === 'discarded' && <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => run(() => restoreStoryAction(slug, id))}>Voltar para revisão</button>}
        {canDelete && status !== 'pending' && (
          <button type="button" className="btn btn-ghost" disabled={pending}
            onClick={() => { if (confirm('Excluir este Story de vez? A imagem será apagada.')) run(() => deleteStoryAction(slug, id)) }}>Excluir</button>
        )}
      </div>
      {error && <p className="notice notice-error" role="alert">{error}</p>}
    </div>
  )
}
