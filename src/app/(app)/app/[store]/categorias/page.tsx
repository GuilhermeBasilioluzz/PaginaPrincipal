import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMembership } from '@/lib/session'
import { can } from '@/lib/permissions'
import { buildCategoryTree } from '@/lib/structure'
import { Field, SubmitButton } from '@/components/ui'
import { ConfirmButton } from '@/components/ConfirmButton'
import { deleteCategoryAction, saveCategoryAction } from './actions'

export const metadata = { title: 'Categorias' }

const FLASH: Record<string, string> = {
  created: 'Categoria criada.', saved: 'Categoria atualizada.', deleted: 'Categoria excluída.',
  invalid: 'Confira os dados informados.', depth: 'Subcategorias não podem ter subcategorias (máximo de 2 níveis).',
  children: 'Esta categoria já tem subcategorias, então não pode virar uma subcategoria.',
  forbidden: 'Você não tem permissão para fazer isso.', not_found: 'Esta categoria não existe mais.', generic: 'Algo deu errado. Tente novamente.',
}

export default async function CategoriesPage({ params, searchParams }: {
  params: Promise<{ store: string }>; searchParams: Promise<{ ok?: string; erro?: string }>
}) {
  const [{ store: slug }, sp] = await Promise.all([params, searchParams])
  const membership = await getMembership(slug)
  if (!membership) notFound()
  const { store, role } = membership
  const manage = can(role, 'manage_structure') && store.is_active

  const supabase = await createClient()
  const { data, error } = await supabase.from('categories').select('id, name, parent_id').eq('store_id', store.id)
  const tree = buildCategoryTree(data ?? [])
  const topLevel = tree.map((n) => ({ id: n.id, name: n.name }))
  const flash = (sp.erro && FLASH[sp.erro]) || (sp.ok && FLASH[sp.ok]) || null

  const Row = ({ id, name, parent, hasChildren, indent }: { id: string; name: string; parent: string | null; hasChildren: boolean; indent?: boolean }) => (
    <li className={`member${indent ? ' indent' : ''}`}>
      {manage ? (
        <form action={saveCategoryAction.bind(null, store.id, slug, id)} className="row grow">
          <input name="name" defaultValue={name} required maxLength={80} aria-label={`Nome da categoria ${name}`} />
          <select name="parent" defaultValue={parent ?? ''} aria-label="Categoria principal" disabled={hasChildren}>
            <option value="">Principal</option>
            {topLevel.filter((t) => t.id !== id).map((t) => <option key={t.id} value={t.id}>Dentro de {t.name}</option>)}
          </select>
          <SubmitButton variant="ghost">Salvar</SubmitButton>
        </form>
      ) : <strong>{name}</strong>}
      {manage && (
        <form action={deleteCategoryAction.bind(null, slug, id)}>
          <ConfirmButton message={`Excluir "${name}"? Os produtos continuam, apenas ficam sem categoria${hasChildren ? ', e as subcategorias viram categorias principais' : ''}.`}>Excluir</ConfirmButton>
        </form>
      )}
    </li>
  )

  return (
    <div className="stack-lg">
      {flash && <p className={`notice ${sp.erro ? 'notice-error' : 'notice-ok'}`} role={sp.erro ? 'alert' : 'status'}>{flash}</p>}
      {error && <p className="notice notice-error" role="alert">Não foi possível carregar as categorias.</p>}

      {manage && (
        <div className="card">
          <h2>Nova categoria</h2>
          <form action={saveCategoryAction.bind(null, store.id, slug, null)} className="stack">
            <Field label="Nome" name="name" required maxLength={80} placeholder="Vestidos" />
            <label className="field">
              <span className="field-label">Dentro de</span>
              <select name="parent" defaultValue="">
                <option value="">Categoria principal</option>
                {topLevel.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <SubmitButton pendingText="Criando…">Criar categoria</SubmitButton>
          </form>
        </div>
      )}

      {tree.length === 0 ? (
        <div className="card empty">
          <h2>Nenhuma categoria ainda.</h2>
          <p className="muted">Categorias organizam o catálogo por tipo de peça: Vestidos, Blusas, Calças…</p>
        </div>
      ) : (
        <div className="card">
          <h2>Categorias</h2>
          <ul className="list">
            {tree.map((n) => (
              <li key={n.id}>
                <ul className="list">
                  <Row id={n.id} name={n.name} parent={null} hasChildren={n.children.length > 0} />
                  {n.children.map((c) => (
                    <Row key={c.id} id={c.id} name={c.name} parent={n.id} hasChildren={false} indent />
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!manage && <p className="muted small">Só donos e gerentes criam e editam categorias.</p>}
    </div>
  )
}
