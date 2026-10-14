'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { StoryActions } from './StoryActions'
import { attachStoriesAction } from '@/app/(app)/app/[store]/stories/actions'
import { storyAge, type StoryItem } from '@/lib/stories'

type Card = StoryItem & { url: string | null }

/** Grade de Stories. Na aba "Para revisar" dá para marcar vários: juntar num produto novo ou anexar a um produto existente. */
export function StoryList({ storeId, slug, items, products, editable, canDelete }: {
  storeId: string; slug: string; items: Card[]; products: { id: string; name: string }[]; editable: boolean; canDelete: boolean
}) {
  const router = useRouter()
  const [picked, setPicked] = useState<string[]>([])
  const [target, setTarget] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const selectable = editable && items.some((i) => i.status === 'pending')
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < 8 ? [...p, id] : p))
  const query = picked.join(',')

  const attach = () => start(async () => {
    const r = await attachStoriesAction(storeId, slug, picked, target)
    setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: 'Fotos adicionadas ao produto.' })
    if (!r.error || r.productId) { setPicked([]); setTarget('') }
    router.refresh()
  })

  return (
    <div className="stack">
      {selectable && picked.length > 0 && (
        <div className="card stack" role="region" aria-label="Ações para os Stories marcados" style={{ position: 'sticky', top: '0.5rem', zIndex: 5 }}>
          <p><strong>{picked.length}</strong> {picked.length === 1 ? 'Story marcado' : 'Stories marcados'} <span className="muted small">(a ordem de marcação vira a ordem das fotos; máximo 8)</span></p>
          <div className="row">
            <Link href={`/app/${slug}/stories/converter?ids=${query}`} className="btn btn-primary">{picked.length === 1 ? 'Transformar em produto' : `Criar 1 produto com ${picked.length} fotos`}</Link>
            <button type="button" className="btn btn-ghost" onClick={() => setPicked([])}>Limpar</button>
          </div>
          {products.length > 0 && (
            <div className="row">
              <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Produto que receberá as fotos">
                <option value="">Adicionar a um produto que já existe…</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button type="button" className="btn btn-ghost" disabled={!target || pending} onClick={attach}>{pending ? 'Adicionando…' : 'Adicionar fotos'}</button>
            </div>
          )}
        </div>
      )}
      {msg && <p className={`notice ${msg.ok ? 'notice-ok' : 'notice-error'}`} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}

      <ul className="photo-grid">
        {items.map((s) => {
          const order = picked.indexOf(s.id)
          return (
            <li key={s.id} className="photo stack">
              {s.url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={s.url} alt={s.caption ?? 'Story recebido'} width={240} height={320} loading="lazy" decoding="async" />
                : <div className="card empty">Imagem indisponível</div>}
              {selectable && s.status === 'pending' && (
                <label className="check">
                  <input type="checkbox" checked={order >= 0} onChange={() => toggle(s.id)} disabled={order < 0 && picked.length >= 8} />
                  {order >= 0 ? `Marcado (${order + 1}º)` : 'Marcar'}
                </label>
              )}
              <p className="muted small">{storyAge(s.posted_at)}{s.author ? ` · ${s.author}` : ''}</p>
              {s.caption && <p className="small">{s.caption}</p>}
              {s.status === 'converted' && s.product_name && s.product_id && <p className="small">Virou <Link className="link" href={`/app/${slug}/produtos/${s.product_id}`}>{s.product_name}</Link></p>}
              {s.status === 'converted' && !s.product_id && <p className="muted small">O produto foi excluído.</p>}
              {editable && <StoryActions slug={slug} id={s.id} status={s.status} canDelete={canDelete} />}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
