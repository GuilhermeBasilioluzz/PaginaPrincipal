'use client'

import { useActionState, useState } from 'react'
import { FormStatus, SubmitButton } from './ui'
import { addSuggestedCategoriesAction, updateCatalogFiltersAction } from '@/app/(app)/app/[store]/configuracoes/actions'
import {
  AUDIENCES, AUDIENCE_LABEL, FILTER_INFO, FILTER_KEYS, FILTER_PRESETS, SUGGESTED_CATEGORIES, type CatalogFilters,
} from '@/lib/catalogFilters'

export function CatalogFiltersForm({ storeId, slug, initial }: { storeId: string; slug: string; initial: CatalogFilters }) {
  const [state, action] = useActionState(updateCatalogFiltersAction.bind(null, storeId, slug), undefined)
  const [catState, catAction] = useActionState(addSuggestedCategoriesAction.bind(null, storeId, slug), undefined)
  const [f, setF] = useState(initial)
  const [stylesText, setStylesText] = useState(initial.styles.join(', '))

  return (
    <div className="stack-lg">
      <form action={action} className="stack">
        <div>
          <h2>Seleção de filtros</h2>
          <p className="muted small">Marque o que a cliente pode usar para buscar no catálogo. O que estiver desmarcado não aparece, mesmo que alguém digite na barra de endereço.</p>
        </div>

        <div className="chip-row" role="group" aria-label="Atalhos">
          {FILTER_PRESETS.map((p) => (
            <button key={p.key} type="button" className="chip" onClick={() => setF((prev) => ({ ...prev, ...p.apply }))}>{p.label}</button>
          ))}
        </div>

        <div className="stack">
          {FILTER_KEYS.map((k) => (
            <label key={k} className="check">
              <input type="checkbox" name={`f_${k}`} checked={f[k]} onChange={(e) => setF((p) => ({ ...p, [k]: e.target.checked }))} />
              <span><strong>{FILTER_INFO[k].label}</strong> <span className="muted small">— {FILTER_INFO[k].hint}</span></span>
            </label>
          ))}
        </div>

        <fieldset className="chips">
          <legend className="field-label">Públicos que a loja atende</legend>
          <p className="muted small">Aparecem no cadastro das peças. Quem escolher "Feminino" ou "Masculino" na loja também vê as peças unissex.</p>
          <div className="chip-row">
            {AUDIENCES.map((a) => (
              <label key={a} className={`chip${f.audiences.includes(a) ? ' chip-on' : ''}`}>
                <input type="checkbox" name="audiences" value={a} checked={f.audiences.includes(a)}
                  onChange={(e) => setF((p) => ({ ...p, audiences: e.target.checked ? [...p.audiences, a] : p.audiences.filter((x) => x !== a) }))} />
                {AUDIENCE_LABEL[a]}
              </label>
            ))}
          </div>
          {!f.audience && <p className="field-hint">O filtro "Público" está desligado: a cliente não verá essa opção.</p>}
        </fieldset>

        <label className="field">
          <span className="field-label">Estilos disponíveis</span>
          <input name="styles" value={stylesText} onChange={(e) => setStylesText(e.target.value)} placeholder="Casual, Festa, Trabalho" maxLength={400} autoComplete="off" />
          <span className="field-hint">Separe por vírgula (até 12). Só aparecem para a cliente os estilos que têm peças.</span>
        </label>

        <FormStatus state={state} />
        <div><SubmitButton pendingText="Salvando…">Salvar filtros</SubmitButton></div>
      </form>

      <form action={catAction} className="stack">
        <h3>Tipos de peça (categorias) sugeridos</h3>
        <p className="muted small">Cria de uma vez as categorias mais comuns (blusas, calças, acessórios…). As que você já tem não são repetidas.</p>
        <div className="row">
          <select name="preset" aria-label="Tipo de loja" defaultValue="feminine">
            {SUGGESTED_CATEGORIES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <SubmitButton variant="ghost" pendingText="Criando…">Criar categorias</SubmitButton>
        </div>
        <FormStatus state={catState} />
      </form>
    </div>
  )
}
