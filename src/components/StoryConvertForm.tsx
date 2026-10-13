'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Field, FormStatus, SubmitButton } from './ui'
import { convertStoryAction } from '@/app/(app)/app/[store]/stories/actions'
import { LETTER_SIZES, NUMBER_SIZES } from '@/lib/sizes'

export function StoryConvertForm({ storeId, slug, storyId, caption, categories }: {
  storeId: string; slug: string; storyId: string; caption: string; categories: { id: string; name: string }[]
}) {
  const [state, action] = useActionState(convertStoryAction.bind(null, storeId, slug, storyId), undefined)
  const [sizes, setSizes] = useState<string[]>([])
  return (
    <form action={action} className="stack">
      <Field label="Nome da peça" name="name" required maxLength={120} autoComplete="off" />
      <div className="grid-2">
        <Field label="Preço (R$)" name="price" required inputMode="decimal" placeholder="189,90" autoComplete="off" />
        <Field label="Quantidade em estoque" name="quantity" required inputMode="numeric" placeholder="0" autoComplete="off" />
      </div>
      <fieldset className="chips">
        <legend className="field-label">Tamanhos</legend>
        <div className="chip-row">
          {[...LETTER_SIZES, ...NUMBER_SIZES].map((s) => (
            <label key={s} className={`chip${sizes.includes(s) ? ' chip-on' : ''}`}>
              <input type="checkbox" name="sizes" value={s} checked={sizes.includes(s)} onChange={() => setSizes((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]))} />
              {s}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid-2">
        <Field label="Cor" name="color" maxLength={40} autoComplete="off" />
        {categories.length > 0 && (
          <label className="field"><span className="field-label">Categoria</span>
            <select name="category" defaultValue=""><option value="">Sem categoria</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        )}
      </div>
      <label className="field"><span className="field-label">Descrição</span><textarea name="description" rows={3} maxLength={2000} defaultValue={caption} /></label>
      <p className="notice">A peça será criada como <strong>rascunho</strong> (fora do catálogo). Você revisa e publica na tela do produto.</p>
      <FormStatus state={state} />
      <div className="row">
        <SubmitButton pendingText="Criando…">Criar produto rascunho</SubmitButton>
        <Link href={`/app/${slug}/stories`} className="btn btn-ghost">Voltar</Link>
      </div>
    </form>
  )
}
