'use client'

import { useState } from 'react'
import { customerMessage, productUrl, questionMessage } from '@/lib/interest'
import { sortSizes, type StockLabel } from '@/lib/catalog'
import { instagramUrl, whatsappUrl } from '@/lib/storeSettings'

/** Escolha de tamanho + botões de contato. A mensagem do WhatsApp já leva a peça, o link e o tamanho escolhido. */
export function ProductActions({ storeSlug, productSlug, name, price, label, sizes, whatsapp, instagram, interestOpen, siteUrl }: {
  storeSlug: string; productSlug: string; name: string; price: number; label: StockLabel; sizes: string[]
  whatsapp: string | null; instagram: string | null; interestOpen: boolean; siteUrl: string
}) {
  const [size, setSize] = useState('')
  const link = productUrl(siteUrl, storeSlug, productSlug)
  const buyable = label === 'available' || label === 'low'
  const ordered = sortSizes(sizes)

  const noWhatsapp = (
    <p className="notice">
      Esta loja ainda não informou um WhatsApp.
      {instagram && <> Fale com ela pelo <a className="link" href={instagramUrl(instagram)} target="_blank" rel="noopener noreferrer">Instagram</a>.</>}
    </p>
  )

  return (
    <div className="stack">
      {ordered.length > 0 && (
        <div>
          <p className="field-label" id="sz-label">Tamanho {size ? <strong>{size}</strong> : <span className="muted">(opcional)</span>}</p>
          <div className="chip-row" role="group" aria-labelledby="sz-label">
            {ordered.map((s) => (
              <button key={s} type="button" className={`size-pill${size === s ? ' size-on' : ''}`} aria-pressed={size === s} onClick={() => setSize(size === s ? '' : s)}>{s}</button>
            ))}
          </div>
        </div>
      )}

      {buyable && (whatsapp ? (
        <div className="stack" style={{ gap: '0.5rem' }}>
          <a className="btn btn-primary" target="_blank" rel="noopener noreferrer"
            href={whatsappUrl(whatsapp, customerMessage(label, name, link, price, size))}>Tenho interesse — falar no WhatsApp</a>
          <a className="link small" target="_blank" rel="noopener noreferrer" href={whatsappUrl(whatsapp, questionMessage(name, link))}>Tirar uma dúvida sobre esta peça</a>
        </div>
      ) : noWhatsapp)}

      {interestOpen && (
        <section className="card stack waitlist" aria-labelledby="avise-h">
          <h2 id="avise-h">{label === 'sold_out' ? 'Esta peça esgotou' : 'Esta peça está reservada'}</h2>
          <p className="muted small">
            {label === 'sold_out'
              ? 'Quer ser avisada se ela voltar? Fale com a loja pelo WhatsApp: a mensagem já vai pronta.'
              : 'Se a reserva não se concretizar, a peça pode voltar. Peça para ser avisada pelo WhatsApp: a mensagem já vai pronta.'}
          </p>
          {whatsapp ? (
            <form action={`/${storeSlug}/produto/${productSlug}/avise-me`} method="post">
              <input type="hidden" name="size" value={size} />
              <button type="submit" className="btn btn-primary">🔔 Avise-me quando chegar{size ? ` (tamanho ${size})` : ''}</button>
            </form>
          ) : noWhatsapp}
        </section>
      )}
    </div>
  )
}
