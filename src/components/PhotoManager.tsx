'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase/browser'
import { prepareImage, ImageError } from '@/lib/resize'
import {
  KIND_LABEL, IMAGE_KINDS, MAX_IMAGES, imagePath, isImageKind, moveItem, nextKind, publicUrl, thumbPath,
} from '@/lib/images'
import {
  registerImageAction, removeImageAction, reorderImagesAction, setImageKindAction, type ActionResult,
} from '@/app/(app)/app/[store]/produtos/image-actions'

export type PhotoItem = { id: string; path: string; kind: string; alt: string | null }

type Upload = { key: string; name: string; status: 'working' | 'error'; message?: string }

export function PhotoManager({ storeId, slug, productId, productName, supabaseUrl, photos, canEdit }: {
  storeId: string; slug: string; productId: string; productName: string
  supabaseUrl: string; photos: PhotoItem[]; canEdit: boolean
}) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [uploads, setUploads] = useState<Upload[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const busy = uploads.some((u) => u.status === 'working') || pending
  const room = MAX_IMAGES - photos.length

  function report(r: ActionResult) {
    setMessage(r.error ?? null)
    router.refresh()
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return
    const list = Array.from(files)
    setMessage(null)
    if (list.length > room) setMessage(`Cabem mais ${room} foto(s). Vamos enviar só as primeiras ${Math.max(room, 0)}.`)
    const supabase = createBrowserSupabase()
    const used = photos.map((p) => p.kind)

    for (const file of list.slice(0, Math.max(room, 0))) {
      const key = `${file.name}-${Math.random()}`
      setUploads((u) => [...u, { key, name: file.name, status: 'working' }])
      const fail = (m: string) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, status: 'error', message: m } : x)))
      let uploaded: string[] = []
      try {
        const img = await prepareImage(file)
        const path = imagePath(storeId, productId, crypto.randomUUID(), img.ext)
        const type = img.ext === 'webp' ? 'image/webp' : 'image/jpeg'
        const opts = { contentType: type, cacheControl: '31536000', upsert: false }

        const up = await supabase.storage.from('catalog').upload(path, img.main, opts)
        if (up.error) throw new ImageError('Falha ao enviar a foto. Verifique sua internet e tente de novo.')
        uploaded = [path]
        const th = await supabase.storage.from('catalog').upload(thumbPath(path), img.thumb, opts)
        if (th.error) throw new ImageError('Falha ao enviar a foto. Verifique sua internet e tente de novo.')
        uploaded.push(thumbPath(path))

        const kind = nextKind(used)
        const res = await registerImageAction(storeId, slug, productId, path, kind, '')
        if (res.error) throw new ImageError(res.error)
        used.push(kind)
        setUploads((u) => u.filter((x) => x.key !== key))
      } catch (e) {
        if (uploaded.length) await supabase.storage.from('catalog').remove(uploaded) // não deixa arquivo órfão
        fail(e instanceof ImageError ? e.message : 'Algo deu errado ao enviar esta foto.')
      }
    }
    if (input.current) input.current.value = ''
    router.refresh()
  }

  const ids = photos.map((p) => p.id)
  const move = (from: number, to: number) => start(async () => report(await reorderImagesAction(slug, productId, moveItem(ids, from, to))))

  return (
    <section className="stack" aria-labelledby="fotos-h">
      <div className="row spread">
        <h2 id="fotos-h" style={{ margin: 0 }}>Fotos <span className="muted small">({photos.length} de {MAX_IMAGES})</span></h2>
        {canEdit && (
          <>
            <button type="button" className="btn btn-primary" disabled={busy || room <= 0} onClick={() => input.current?.click()}>
              {busy ? 'Enviando…' : '+ Adicionar fotos'}
            </button>
            <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
          </>
        )}
      </div>

      {message && <p className="notice notice-error" role="alert">{message}</p>}
      {uploads.map((u) => (
        <p key={u.key} className={`notice ${u.status === 'error' ? 'notice-error' : ''}`} role={u.status === 'error' ? 'alert' : 'status'}>
          {u.status === 'working' ? `Preparando e enviando ${u.name}…` : `${u.name}: ${u.message}`}
          {u.status === 'error' && <> <button type="button" className="link" onClick={() => setUploads((x) => x.filter((y) => y.key !== u.key))}>Dispensar</button></>}
        </p>
      ))}

      {photos.length === 0 ? (
        <div className="card empty">
          <h2>Este produto ainda não tem fotos.</h2>
          <p className="muted">Comece pela foto de frente. As fotos são reduzidas automaticamente para carregar rápido.</p>
        </div>
      ) : (
        <ul className="photo-grid">
          {photos.map((p, i) => (
            <li key={p.id} className="photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={publicUrl(supabaseUrl, thumbPath(p.path))} alt={p.alt || `${productName} — ${KIND_LABEL[isImageKind(p.kind) ? p.kind : 'other']}`}
                width={240} height={320} loading="lazy" decoding="async" />
              {i === 0 && <span className="badge photo-main">Principal</span>}
              {canEdit && (
                <div className="photo-tools">
                  <select value={p.kind} disabled={busy} aria-label="Tipo da foto"
                    onChange={(e) => start(async () => report(await setImageKindAction(slug, p.id, e.target.value)))}>
                    {IMAGE_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                  </select>
                  <div className="row">
                    <button type="button" className="btn btn-ghost" disabled={busy || i === 0} aria-label="Mover para o início" onClick={() => move(i, i - 1)}>◀</button>
                    <button type="button" className="btn btn-ghost" disabled={busy || i === photos.length - 1} aria-label="Mover para o fim" onClick={() => move(i, i + 1)}>▶</button>
                    {i > 0 && <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => move(i, 0)}>Principal</button>}
                    <button type="button" className="btn btn-danger" disabled={busy}
                      onClick={() => { if (window.confirm('Remover esta foto?')) start(async () => report(await removeImageAction(slug, p.id))) }}>Remover</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
