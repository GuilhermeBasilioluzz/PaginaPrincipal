'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Field, SubmitButton } from './ui'

export type CollectionValues = { name: string; description: string; kind: 'manual' | 'new_arrivals'; days: string; published: boolean }
export const EMPTY_COLLECTION: CollectionValues = { name: '', description: '', kind: 'manual', days: '7', published: true }

/** Formulário simples (envia direto ao servidor; os campos não se perdem porque o servidor redireciona ao salvar). */
export function CollectionForm({ action, initial, cancelHref, submitLabel }: {
  action: (fd: FormData) => void | Promise<void>
  initial: CollectionValues
  cancelHref: string
  submitLabel: string
}) {
  const [kind, setKind] = useState(initial.kind)
  return (
    <form action={action} className="stack">
      <Field label="Nome da coleção" name="name" defaultValue={initial.name} required maxLength={80} placeholder="Coleção Primavera" />
      <label className="field">
        <span className="field-label">Descrição (opcional)</span>
        <textarea name="description" rows={2} maxLength={500} defaultValue={initial.description} />
      </label>
      <fieldset className="chips">
        <legend className="field-label">Como as peças entram</legend>
        <label className="check">
          <input type="radio" name="kind" value="manual" checked={kind === 'manual'} onChange={() => setKind('manual')} />
          Eu escolho as peças
        </label>
        <label className="check">
          <input type="radio" name="kind" value="new_arrivals" checked={kind === 'new_arrivals'} onChange={() => setKind('new_arrivals')} />
          Automática: peças adicionadas nos últimos dias (Novidades)
        </label>
      </fieldset>
      {kind === 'new_arrivals' && (
        <Field label="Quantos dias contam como novidade?" name="days" defaultValue={initial.days} inputMode="numeric" required />
      )}
      <label className="check">
        <input type="checkbox" name="published" defaultChecked={initial.published} />
        Publicada no catálogo (desmarque para deixar como rascunho)
      </label>
      <div className="row">
        <SubmitButton pendingText="Salvando…">{submitLabel}</SubmitButton>
        <Link href={cancelHref} className="btn btn-ghost">Cancelar</Link>
      </div>
    </form>
  )
}
