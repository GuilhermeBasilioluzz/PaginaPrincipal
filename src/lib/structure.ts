import { z } from 'zod'
import { slugify } from './slug'

const name = (label: string) => z.string().trim().min(1, `Informe o nome da ${label}.`).max(80, 'O nome é longo demais (máximo 80).')
const uuidOrEmpty = z.string().optional().refine((v) => !v || /^[0-9a-f-]{36}$/i.test(v), 'Seleção inválida.')

export const categorySchema = z.object({ name: name('categoria'), parent: uuidOrEmpty })

export const collectionSchema = z
  .object({
    name: name('coleção'),
    description: z.string().trim().max(500, 'A descrição é longa demais (máximo 500).').optional(),
    kind: z.enum(['manual', 'new_arrivals']),
    days: z.string().optional(),
    published: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.kind !== 'new_arrivals') return
    const n = Number(v.days)
    if (!Number.isInteger(n) || n < 1 || n > 90) {
      ctx.addIssue({ code: 'custom', path: ['days'], message: 'Informe de 1 a 90 dias para as novidades.' })
    }
  })

export type Parsed<T> = { ok: true; payload: T } | { ok: false; error: string }
const text = (fd: FormData, k: string) => String(fd.get(k) ?? '')

export function readCategoryForm(fd: FormData): Parsed<{ name: string; slug_base: string; parent_id: string }> {
  const r = categorySchema.safeParse({ name: text(fd, 'name'), parent: text(fd, 'parent') })
  if (!r.success) return { ok: false, error: r.error.issues[0]?.message ?? 'Dados inválidos.' }
  return { ok: true, payload: { name: r.data.name, slug_base: slugify(r.data.name) || 'categoria', parent_id: r.data.parent ?? '' } }
}

export function readCollectionForm(fd: FormData): Parsed<{
  name: string; slug_base: string; description: string; kind: string; days: string; published: boolean
}> {
  const r = collectionSchema.safeParse({
    name: text(fd, 'name'), description: text(fd, 'description'), kind: text(fd, 'kind') || 'manual',
    days: text(fd, 'days'), published: fd.get('published') === 'on',
  })
  if (!r.success) return { ok: false, error: r.error.issues[0]?.message ?? 'Dados inválidos.' }
  const d = r.data
  return {
    ok: true,
    payload: {
      name: d.name, slug_base: slugify(d.name) || 'colecao', description: d.description ?? '', kind: d.kind,
      days: d.kind === 'new_arrivals' ? String(Number(d.days)) : '', published: d.published,
    },
  }
}

/** Ids de coleções marcadas no formulário do produto (só uuids válidos, sem repetir). */
export function readCollectionIds(fd: FormData): string[] {
  const ids = fd.getAll('collections').map(String).filter((v) => /^[0-9a-f-]{36}$/i.test(v))
  return [...new Set(ids)]
}

export type CategoryNode = { id: string; name: string; parent_id: string | null; children: CategoryNode[] }

/** Lista plana → árvore de 2 níveis, em ordem alfabética. Itens órfãos viram categorias principais. */
export function buildCategoryTree(rows: { id: string; name: string; parent_id: string | null }[]): CategoryNode[] {
  const byName = (a: CategoryNode, b: CategoryNode) => a.name.localeCompare(b.name, 'pt-BR')
  const nodes = new Map(rows.map((r) => [r.id, { ...r, children: [] as CategoryNode[] }]))
  const roots: CategoryNode[] = []
  for (const n of nodes.values()) {
    const parent = n.parent_id ? nodes.get(n.parent_id) : undefined
    if (parent && !parent.parent_id) parent.children.push(n)
    else roots.push(n)
  }
  roots.sort(byName)
  roots.forEach((r) => r.children.sort(byName))
  return roots
}
