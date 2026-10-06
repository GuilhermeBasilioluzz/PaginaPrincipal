'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase/browser'
import { prepareImage, ImageError } from '@/lib/resize'
import { brandingPath, publicUrl, type BrandingKind } from '@/lib/images'
import { setBrandingAction } from '@/app/(app)/app/[store]/configuracoes/actions'

const LABEL: Record<BrandingKind, string> = { logo: 'Logo', banner: 'Banner' }
const MAX: Record<BrandingKind, number> = { logo: 512, banner: 1600 }
const HINT: Record<BrandingKind, string> = {
  logo: 'Imagem quadrada ou redonda funciona melhor. Reduzimos para 512 px.',
  banner: 'Imagem larga (por exemplo 1600×600). Aparece no topo do catálogo.',
}

export function BrandingUploader({ storeId, slug, kind, currentPath, supabaseUrl, canEdit }: {
  storeId: string; slug: string; kind: BrandingKind; currentPath: string | null; supabaseUrl: string; canEdit: boolean
}) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  async function onFile(file: File | undefined) {
    if (!file) return
    setBusy(true); setError(null)
    const supabase = createBrowserSupabase()
    let uploaded: string | null = null
    try {
      const img = await prepareImage(file, { maxSide: MAX[kind], withThumb: false })
      const path = brandingPath(storeId, kind, crypto.randomUUID(), img.ext)
      const up = await supabase.storage.from('catalog').upload(path, img.main, {
        contentType: img.ext === 'webp' ? 'image/webp' : 'image/jpeg', cacheControl: '31536000', upsert: false,
      })
      if (up.error) throw new ImageError('Falha ao enviar. Só o dono da loja pode alterar a identidade visual.')
      uploaded = path
      const res = await setBrandingAction(storeId, slug, kind, path)
      if (res.error) throw new ImageError(res.error)
      router.refresh()
    } catch (e) {
      if (uploaded) await supabase.storage.from('catalog').remove([uploaded])
      setError(e instanceof ImageError ? e.message : 'Algo deu errado ao enviar a imagem.')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  const remove = () => start(async () => {
    const res = await setBrandingAction(storeId, slug, kind, null)
    setError(res.error ?? null)
    router.refresh()
  })

  return (
    <div className="branding">
      <div className={`branding-preview branding-${kind}`}>
        {currentPath
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={publicUrl(supabaseUrl, currentPath)} alt={`${LABEL[kind]} atual da loja`} />
          : <span className="muted small">Sem {LABEL[kind].toLowerCase()}</span>}
      </div>
      <div className="stack" style={{ gap: '0.4rem' }}>
        <strong>{LABEL[kind]}</strong>
        <span className="muted small">{HINT[kind]}</span>
        {canEdit && (
          <div className="row">
            <button type="button" className="btn btn-ghost" disabled={busy || pending} onClick={() => input.current?.click()}>
              {busy ? 'Enviando…' : currentPath ? 'Trocar' : 'Enviar imagem'}
            </button>
            {currentPath && <button type="button" className="btn btn-danger" disabled={busy || pending} onClick={remove}>Remover</button>}
            <input ref={input} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          </div>
        )}
        {error && <p className="notice notice-error" role="alert">{error}</p>}
      </div>
    </div>
  )
}
