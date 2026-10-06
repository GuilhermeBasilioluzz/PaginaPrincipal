'use client'

import { useEffect, useRef, useState } from 'react'
import { copyText, shareWhatsappUrl } from '@/lib/share'

/** Compartilhar: menu nativo do celular (quando existe), WhatsApp e copiar link. Não pede conta nem dados. */
export function ShareBar({ url, title, text }: { url: string; title: string; text: string }) {
  const [canShare, setCanShare] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => { setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function') }, [])
  useEffect(() => () => clearTimeout(timer.current), [])

  const say = (m: string) => { setStatus(m); clearTimeout(timer.current); timer.current = setTimeout(() => setStatus(null), 3000) }

  async function nativeShare() {
    try { await navigator.share({ title, text, url }) }
    catch (e) { if ((e as DOMException)?.name !== 'AbortError') say('Não foi possível abrir o compartilhamento.') } // cancelar não é erro
  }
  async function copy() { say((await copyText(url)) ? 'Link copiado!' : 'Não foi possível copiar. Copie o endereço do navegador.') }

  return (
    <div className="share" role="group" aria-label="Compartilhar esta peça">
      {canShare && <button type="button" className="btn btn-ghost" onClick={nativeShare}>Compartilhar</button>}
      <a className="btn btn-ghost" href={shareWhatsappUrl(text, url)} target="_blank" rel="noopener noreferrer">Enviar no WhatsApp</a>
      <button type="button" className="btn btn-ghost" onClick={copy}>Copiar link</button>
      <span className="small muted share-status" role="status" aria-live="polite">{status}</span>
    </div>
  )
}
