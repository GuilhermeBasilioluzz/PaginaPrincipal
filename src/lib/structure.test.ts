import { describe, expect, it } from 'vitest'
import { buildCategoryTree, readCategoryForm, readCollectionForm, readCollectionIds } from './structure'

function form(o: Record<string, string | string[]>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(o)) (Array.isArray(v) ? v : [v]).forEach((x) => fd.append(k, x))
  return fd
}

describe('categoria', () => {
  it('monta o payload com endereço', () => {
    const r = readCategoryForm(form({ name: ' Blusas e Camisas ', parent: '' }))
    expect(r.ok && r.payload).toEqual({ name: 'Blusas e Camisas', slug_base: 'blusas-e-camisas', parent_id: '' })
  })
  it('recusa vazio, longo e pai inválido', () => {
    expect(readCategoryForm(form({ name: '  ' })).ok).toBe(false)
    expect(readCategoryForm(form({ name: 'x'.repeat(81) })).ok).toBe(false)
    expect(readCategoryForm(form({ name: 'ok', parent: 'drop' })).ok).toBe(false)
  })
})

describe('coleção', () => {
  it('manual ignora os dias', () => {
    const r = readCollectionForm(form({ name: 'Primavera', kind: 'manual', days: '99', published: 'on' }))
    expect(r.ok && r.payload).toMatchObject({ kind: 'manual', days: '', published: true, slug_base: 'primavera' })
  })
  it('novidades exige 1 a 90 dias', () => {
    expect(readCollectionForm(form({ name: 'N', kind: 'new_arrivals', days: '7' })).ok).toBe(true)
    for (const bad of ['0', '91', 'abc', '', '2.5']) expect(readCollectionForm(form({ name: 'N', kind: 'new_arrivals', days: bad })).ok).toBe(false)
  })
  it('rascunho quando "publicada" não está marcada', () => {
    const r = readCollectionForm(form({ name: 'X', kind: 'manual' }))
    expect(r.ok && r.payload.published).toBe(false)
  })
  it('tipo desconhecido é recusado', () => {
    expect(readCollectionForm(form({ name: 'X', kind: 'magica' })).ok).toBe(false)
  })
})

describe('ids e árvore', () => {
  it('lê só uuids, sem repetir', () => {
    const id = 'dddddddd-0000-0000-0000-00000000000a'
    expect(readCollectionIds(form({ collections: [id, id, 'lixo', '1; drop'] }))).toEqual([id])
  })
  it('monta árvore de 2 níveis ordenada', () => {
    const t = buildCategoryTree([
      { id: '2', name: 'Midi', parent_id: '1' }, { id: '1', name: 'Vestidos', parent_id: null },
      { id: '3', name: 'Blusas', parent_id: null }, { id: '4', name: 'Curto', parent_id: '1' },
      { id: '5', name: 'Órfã', parent_id: 'inexistente' },
    ])
    expect(t.map((n) => n.name)).toEqual(['Blusas', 'Órfã', 'Vestidos'])
    expect(t[2].children.map((c) => c.name)).toEqual(['Curto', 'Midi'])
  })
})
