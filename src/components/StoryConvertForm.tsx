'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Field, FormStatus, SubmitButton } from './ui'
import { convertStoriesAction } from '@/app/(app)/app/[store]/stories/actions'
import { LETTER_SIZES, NUMBER_SIZES } from '@/lib/sizes'
import { AUDIENCE_LABEL, type CatalogFilters } from '@/lib/catalogFilters'

export function StoryConvertForm({ storeId, slug, storyIds, caption, categories, collections, filters, hasMorePending }: {
  storeId: string; slug: string; storyIds: string[]; caption: string
  categories: { id: string; name: string }[]; collections: { id: string; name: string }[]
  filters: CatalogFilters; hasMorePending: boolean
}) {
  const [state, action] = useActionState(convertStoriesAction.bind(null, storeId, slug, storyIds), undefined)
  const [sizes, setSizes] = useState<string[]>([])
  const [styles, setStyles] = useState<string[]>([])
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
      {filters.audience
        ? (
          <label className="field"><span className="field-label">Público</span>
            <select name="audience" defaultValue={filters.audiences[0]}>{filters.audiences.map((a) => <option key={a} value={a}>{AUDIENCE_LABEL[a]}</option>)}</select></label>
        )
        : <input type="hidden" name="audience" value={filters.audiences[0]} />}
      {filters.style && filters.styles.length > 0 && (
        <fieldset className="chips">
          <legend className="field-label">Estilo</legend>
          <input type="hidden" name="styles_present" value="1" />
          <div className="chip-row">
            {filters.styles.map((s) => (
              <label key={s} className={`chip${styles.includes(s) ? ' chip-on' : ''}`}>
                <input type="checkbox" name="styles" value={s} checked={styles.includes(s)} onChange={() => setStyles((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]))} />
                {s}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {collections.length > 0 && (
        <fieldset className="chips">
          <legend className="field-label">Coleções</legend>
          <div className="chip-row">
            {collections.map((c) => <label key={c.id} className="check"><input type="checkbox" name="collections" value={c.id} /> {c.name}</label>)}
          </div>
          <p className="field-hint">A coleção só aparece para a cliente quando você publicar a peça.</p>
        </fieldset>
      )}
      <label className="field"><span className="field-label">Descrição</span><textarea name="description" rows={3} maxLength={2000} defaultValue={caption} /></label>
      <p className="notice">A peça será criada como <strong>rascunho</strong> (fora do catálogo). Você revisa e publica na tela do produto.</p>
      {hasMorePending && (
        <label className="check"><input type="checkbox" name="next" defaultChecked /> Depois de criar, abrir o próximo Story da fila</label>
      )}
      <FormStatus state={state} />
      <div className="row">
        <SubmitButton pendingText="Criando…">Criar produto rascunho</SubmitButton>
        <Link href={`/app/${slug}/stories`} className="btn btn-ghost">Voltar</Link>
      </div>
    </form>
  )
}
