'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase/browser'
import { prepareImage, ImageError } from '@/lib/resize'
import { MAX_STORY_BATCH, MAX_STORY_CAPTION, storyPath, storyThumbPath } from '@/lib/stories'
import { registerStoryAction } from '@/app/(app)/app/[store]/stories/actions'

type Upload = { key: string; name: string; status: 'working' | 'error'; message?: string }

/** Envia prints/imagens de Stories para a caixa de revisão. Cada imagem é reduzida no celular antes de subir. */
export function StoryUploader({ storeId, slug }: { storeId: string; slug: string }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [caption, setCaption] = useState('')
  const [uploads, setUploads] = useState<Upload[]>([])
  const [note, setNote] = useState<string | null>(null)
  const busy = uploads.some((u) => u.status === 'working')

  async function onFiles(files: FileList | null) {
    if (!files?.length) return
    const list = Array.from(files)
    setNote(list.length > MAX_STORY_BATCH ? `Enviamos só os primeiros ${MAX_STORY_BATCH}. Envie o restante em seguida.` : null)
    const supabase = createBrowserSupabase()
    for (const file of list.slice(0, MAX_STORY_BATCH)) {
      const key = `${file.name}-${Math.random()}`
      setUploads((u) => [...u, { key, name: file.name, status: 'working' }])
      const fail = (m: string) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, status: 'error', message: m } : x)))
      let sent: string[] = []
      try {
        const img = await prepareImage(file)
        const path = storyPath(storeId, crypto.randomUUID(), img.ext)
        const opts = { contentType: img.ext === 'webp' ? 'image/webp' : 'image/jpeg', cacheControl: '3600', upsert: false }
        const up = await supabase.storage.from('stories').upload(path, img.main, opts)
        if (up.error) throw new ImageError('Falha ao enviar. Verifique sua internet e tente de novo.')
        sent = [path]
        const th = await supabase.storage.from('stories').upload(storyThumbPath(path), img.thumb, opts)
        if (th.error) throw new ImageError('Falha ao enviar. Verifique sua internet e tente de novo.')
        sent.push(storyThumbPath(path))
        const res = await registerStoryAction(storeId, slug, path, caption)
        if (res.error) throw new ImageError(res.error)
        setUploads((u) => u.filter((x) => x.key !== key))
      } catch (e) {
        if (sent.length) await supabase.storage.from('stories').remove(sent)
        fail(e instanceof ImageError ? e.message : 'Algo deu errado ao enviar esta imagem.')
      }
    }
    if (input.current) input.current.value = ''
    setCaption('')
    router.refresh()
  }

  return (
    <div className="stack">
      <label className="field">
        <span className="field-label">Anotação (opcional)</span>
        <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={MAX_STORY_CAPTION} placeholder="Ex.: vestido midi verde, R$ 189,90, P/M/G" autoComplete="off" />
        <span className="field-hint">Vale para as imagens que você enviar agora. Ajuda a lembrar preço e tamanhos na hora de cadastrar.</span>
      </label>
      <div>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Enviando…' : '+ Enviar prints de Stories'}</button>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => onFiles(e.target.files)} />
      </div>
      {note && <p className="notice" role="status">{note}</p>}
      {uploads.map((u) => (
        <p key={u.key} className={`notice ${u.status === 'error' ? 'notice-error' : ''}`} role={u.status === 'error' ? 'alert' : 'status'}>
          {u.status === 'working' ? `Preparando e enviando ${u.name}…` : `${u.name}: ${u.message}`}
          {u.status === 'error' && <> <button type="button" className="link" onClick={() => setUploads((x) => x.filter((y) => y.key !== u.key))}>Dispensar</button></>}
        </p>
      ))}
    </div>
  )
}
