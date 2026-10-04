'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { Field, FormStatus, SubmitButton } from './ui'
import { saveProductAction } from '@/app/(app)/app/[store]/produtos/actions'
import { LETTER_SIZES, NUMBER_SIZES } from '@/lib/sizes'
import { COLOR_SUGGESTIONS } from '@/lib/products'
import { STATUS_LABEL } from '@/lib/dashboard'

export type ProductFormValues = {
  name: string; price: string; promo: string; quantity: string; color: string; sku: string
  description: string; video: string; status: string; category: string; featured: boolean
  sizes: string[]; sizesExtra: string
}

export const EMPTY_PRODUCT: ProductFormValues = {
  name: '', price: '', promo: '', quantity: '', color: '', sku: '', description: '', video: '',
  status: 'available', category: '', featured: false, sizes: [], sizesExtra: '',
}

const STATUS_OPTIONS = ['available', 'reserved', 'sold', 'unavailable'] as const

export function ProductForm({ storeId, slug, productId, initial, categories, archived }: {
  storeId: string
  slug: string
  productId: string | null
  initial: ProductFormValues
  categories: { id: string; name: string }[]
  archived: boolean
}) {
  const [state, action] = useActionState(saveProductAction.bind(null, storeId, slug, productId, archived), undefined)
  const [v, setV] = useState(initial)
  const set = <K extends keyof ProductFormValues>(k: K, value: ProductFormValues[K]) => setV((p) => ({ ...p, [k]: value }))
  const text = (k: 'name' | 'price' | 'promo' | 'quantity' | 'color' | 'sku' | 'video' | 'description' | 'sizesExtra') =>
    ({ name: k, value: v[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value) })
  const toggleSize = (s: string) => set('sizes', v.sizes.includes(s) ? v.sizes.filter((x) => x !== s) : [...v.sizes, s])
  const advancedFilled = !!(v.promo || v.sku || v.video || v.description || v.featured || v.category)

  return (
    <form action={action} className="stack-lg">
      <div className="stack">
        <Field label="Nome da peça" required maxLength={120} autoComplete="off" {...text('name')} />
        <div className="grid-2">
          <Field label="Preço (R$)" required inputMode="decimal" placeholder="189,90" autoComplete="off" {...text('price')} />
          <Field label="Quantidade em estoque" required inputMode="numeric" placeholder="0" autoComplete="off" {...text('quantity')} />
        </div>

        <fieldset className="chips">
          <legend className="field-label">Tamanhos</legend>
          <div className="chip-row">
            {[...LETTER_SIZES, ...NUMBER_SIZES].map((s) => (
              <label key={s} className={`chip${v.sizes.includes(s) ? ' chip-on' : ''}`}>
                <input type="checkbox" name="sizes" value={s} checked={v.sizes.includes(s)} onChange={() => toggleSize(s)} />
                {s}
              </label>
            ))}
          </div>
          <Field label="Outros tamanhos" placeholder="48, 50, Plus" hint="Separe por vírgula." {...text('sizesExtra')} />
        </fieldset>

        <div className="grid-2">
          <label className="field">
            <span className="field-label">Cor</span>
            <input list="cores" autoComplete="off" {...text('color')} />
            <datalist id="cores">{COLOR_SUGGESTIONS.map((c) => <option key={c} value={c} />)}</datalist>
          </label>
          {!archived && (
            <label className="field">
              <span className="field-label">Situação</span>
              <select name="status" value={v.status} onChange={(e) => set('status', e.target.value)}>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </label>
          )}
        </div>
      </div>

      <details className="advanced" open={advancedFilled || undefined}>
        <summary>Mais opções</summary>
        <div className="stack">
          <Field label="Preço promocional (R$)" inputMode="decimal" placeholder="149,90" hint="Precisa ser menor que o preço." autoComplete="off" {...text('promo')} />
          {categories.length > 0 && (
            <label className="field">
              <span className="field-label">Categoria</span>
              <select name="category" value={v.category} onChange={(e) => set('category', e.target.value)}>
                <option value="">Sem categoria</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          )}
          <Field label="Código interno (SKU)" maxLength={40} autoComplete="off" {...text('sku')} />
          <label className="field">
            <span className="field-label">Descrição</span>
            <textarea rows={4} maxLength={2000} {...text('description')} />
          </label>
          <Field label="Link de vídeo (opcional)" type="url" placeholder="https://" autoComplete="off" {...text('video')} />
          <label className="check">
            <input type="checkbox" name="featured" checked={v.featured} onChange={(e) => set('featured', e.target.checked)} />
            Destacar esta peça
          </label>
        </div>
      </details>

      <FormStatus state={state} />
      <div className="row">
        <SubmitButton pendingText="Salvando…">{productId ? 'Salvar alterações' : 'Salvar produto'}</SubmitButton>
        <Link href={`/app/${slug}/produtos`} className="btn btn-ghost">Cancelar</Link>
      </div>
    </form>
  )
}
