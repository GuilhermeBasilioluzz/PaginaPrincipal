'use client'

import { useActionState, useState, useTransition } from 'react'
import Link from 'next/link'
import { Field, FormStatus, SubmitButton } from './ui'
import { convertStoriesAction } from '@/app/(app)/app/[store]/stories/actions'
import { suggestStoriesAction } from '@/app/(app)/app/[store]/stories/ai-actions'
import { LETTER_SIZES, NUMBER_SIZES } from '@/lib/sizes'
import { AUDIENCE_LABEL, type CatalogFilters } from '@/lib/catalogFilters'
import type { AiSuggestion } from '@/lib/ai'

export function StoryConvertForm({ storeId, slug, storyIds, caption, categories, collections, filters, hasMorePending, aiEnabled }: {
  storeId: string; slug: string; storyIds: string[]; caption: string
  categories: { id: string; name: string }[]; collections: { id: string; name: string }[]
  filters: CatalogFilters; hasMorePending: boolean; aiEnabled: boolean
}) {
  const [state, action] = useActionState(convertStoriesAction.bind(null, storeId, slug, storyIds), undefined)
  const [v, setV] = useState({
    name: '', price: '', quantity: '', color: '', category: '', description: caption,
    audience: filters.audiences[0] as string, sizes: [] as string[], styles: [] as string[], collections: [] as string[],
  })
  const [ai, setAi] = useState<{ hint?: AiSuggestion; error?: string; remaining?: number } | null>(null)
  const [asking, ask] = useTransition()
  const set = <K extends keyof typeof v>(k: K, value: (typeof v)[K]) => setV((p) => ({ ...p, [k]: value }))
  const toggle = (k: 'sizes' | 'styles' | 'collections', value: string) => set(k, v[k].includes(value) ? v[k].filter((x) => x !== value) : [...v[k], value])

  const suggest = () => ask(async () => {
    const r = await suggestStoriesAction(storeId, storyIds)
    if (!r.ok) { setAi({ error: r.error }); return }
    const s = r.suggestion
    // a IA só preenche texto e classificação; preço, quantidade e tamanhos continuam com a pessoa
    setV((p) => ({
      ...p,
      name: s.name || p.name, description: s.description || p.description, color: s.color || p.color,
      category: s.categoryId || p.category, audience: s.audience || p.audience,
      styles: s.styles.length ? s.styles : p.styles, collections: s.collectionIds.length ? s.collectionIds : p.collections,
    }))
    setAi({ hint: s, remaining: r.remaining })
  })

  return (
    <form action={action} className="stack">
      {aiEnabled && (
        <div className="card stack">
          <div className="row spread">
            <div>
              <strong>Sugestão de IA</strong>
              <p className="muted small">A IA olha a imagem e sugere nome, descrição, cor, categoria, coleção e estilo. Preço, estoque e tamanhos são sempre seus. Revise tudo antes de criar.</p>
            </div>
            <button type="button" className="btn btn-ghost" disabled={asking} onClick={suggest}>{asking ? 'Analisando…' : 'Sugerir com IA'}</button>
          </div>
          {ai?.error && <p className="notice notice-error" role="alert">{ai.error}</p>}
          {ai?.hint && (
            <div className="notice notice-ok" role="status">
              <p>Sugestão aplicada nos campos abaixo. <strong>Confira antes de criar.</strong>{ai.remaining !== undefined && <span className="muted small"> Restam {ai.remaining} sugestões hoje.</span>}</p>
              {(ai.hint.priceHint || ai.hint.sizesSeen.length > 0) && (
                <p className="small">
                  Lido no Story (só como lembrete):{ai.hint.priceHint && <> preço <strong>{ai.hint.priceHint}</strong>.</>}{ai.hint.sizesSeen.length > 0 && <> tamanhos <strong>{ai.hint.sizesSeen.join(', ')}</strong>.</>}
                </p>
              )}
            </div>
          )}
        </div>
      )}
      <Field label="Nome da peça" name="name" required maxLength={120} autoComplete="off" value={v.name} onChange={(e) => set('name', e.target.value)} />
      <div className="grid-2">
        <Field label="Preço (R$)" name="price" required inputMode="decimal" placeholder="189,90" autoComplete="off" value={v.price} onChange={(e) => set('price', e.target.value)} />
        <Field label="Quantidade em estoque" name="quantity" required inputMode="numeric" placeholder="0" autoComplete="off" value={v.quantity} onChange={(e) => set('quantity', e.target.value)} />
      </div>
      <fieldset className="chips">
        <legend className="field-label">Tamanhos</legend>
        <div className="chip-row">
          {[...LETTER_SIZES, ...NUMBER_SIZES].map((s) => (
            <label key={s} className={`chip${v.sizes.includes(s) ? ' chip-on' : ''}`}>
              <input type="checkbox" name="sizes" value={s} checked={v.sizes.includes(s)} onChange={() => toggle('sizes', s)} />
              {s}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid-2">
        <Field label="Cor" name="color" maxLength={40} autoComplete="off" value={v.color} onChange={(e) => set('color', e.target.value)} />
        {categories.length > 0 && (
          <label className="field"><span className="field-label">Categoria</span>
            <select name="category" value={v.category} onChange={(e) => set('category', e.target.value)}><option value="">Sem categoria</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        )}
      </div>
      {filters.audience
        ? (
          <label className="field"><span className="field-label">Público</span>
            <select name="audience" value={v.audience} onChange={(e) => set('audience', e.target.value)}>{filters.audiences.map((a) => <option key={a} value={a}>{AUDIENCE_LABEL[a]}</option>)}</select></label>
        )
        : <input type="hidden" name="audience" value={filters.audiences[0]} />}
      {filters.style && filters.styles.length > 0 && (
        <fieldset className="chips">
          <legend className="field-label">Estilo</legend>
          <input type="hidden" name="styles_present" value="1" />
          <div className="chip-row">
            {filters.styles.map((s) => (
              <label key={s} className={`chip${v.styles.includes(s) ? ' chip-on' : ''}`}>
                <input type="checkbox" name="styles" value={s} checked={v.styles.includes(s)} onChange={() => toggle('styles', s)} />
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
            {collections.map((c) => <label key={c.id} className="check"><input type="checkbox" name="collections" value={c.id} checked={v.collections.includes(c.id)} onChange={() => toggle('collections', c.id)} /> {c.name}</label>)}
          </div>
          <p className="field-hint">A coleção só aparece para a cliente quando você publicar a peça.</p>
        </fieldset>
      )}
      <label className="field"><span className="field-label">Descrição</span><textarea name="description" rows={3} maxLength={2000} value={v.description} onChange={(e) => set('description', e.target.value)} /></label>
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
