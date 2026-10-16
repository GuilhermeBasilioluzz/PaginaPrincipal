'use client'

import { useState } from 'react'
import { copyText, shareWhatsappUrl } from '@/lib/share'

/** Cartão de compartilhamento: QR, link, copiar, WhatsApp, baixar PNG e cartaz para imprimir. */
export function ShareCard({ title, url, bioUrl, storyUrl, qrSrc, posterHref, text }: { title: string; url: string; bioUrl: string; storyUrl: string; qrSrc: string; posterHref: string; text: string }) {
  const [status, setStatus] = useState<string | null>(null)
  const copy = async (value: string, what: string) => {
    setStatus((await copyText(value)) ? `${what} copiado!` : 'Não foi possível copiar. Selecione o link acima.')
    setTimeout(() => setStatus(null), 2500)
  }
  return (
    <article className="card stack share-card">
      <h3>{title}</h3>
      <div className="share-qr">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrSrc} alt={`QR Code de ${title}`} width={160} height={160} loading="lazy" />
        <div className="stack">
          <p><code>{url}</code></p>
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={() => copy(url, 'Link')}>Copiar link</button>
            <a className="btn btn-ghost" href={shareWhatsappUrl(text, `${url}?o=whatsapp`)} target="_blank" rel="noopener noreferrer">Enviar no WhatsApp</a>
          </div>
          <div className="row">
            <button type="button" className="btn btn-ghost" onClick={() => copy(bioUrl, 'Link da bio')}>Link para a bio</button>
            <button type="button" className="btn btn-ghost" onClick={() => copy(storyUrl, 'Link do Story')}>Link para Story</button>
          </div>
          <div className="row">
            <a className="btn btn-ghost" href={`${qrSrc}&formato=png&baixar=1`}>Baixar QR (PNG)</a>
            <a className="btn btn-ghost" href={posterHref}>Cartaz para imprimir</a>
          </div>
          <span className="small muted" role="status" aria-live="polite">{status}</span>
        </div>
      </div>
    </article>
  )
}
