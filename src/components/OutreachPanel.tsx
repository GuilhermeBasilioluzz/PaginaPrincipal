import { useEffect, useRef, useState } from 'react'
import type { Niche } from '../data/niches'
import type { LeadStatus } from '../lib/crm'
import { whatsappUrl, type PlaceInfo } from '../lib/leads'
import { buildMessage, messageKinds, whatsappWithText, type MessageKind } from '../lib/outreach'

interface Props {
  place: PlaceInfo
  niche: Niche
  status: LeadStatus
  senderName: string
  contactName: string
  /** Chamado quando a mensagem é enviada, para avançar o contato no funil. */
  onSent: (next: LeadStatus) => void
}

/** Mensagem sugerida para cada etapa do funil. */
function kindFor(status: LeadStatus): MessageKind {
  if (status === 'interested') return 'proposal'
  if (status === 'contacted' || status === 'proposal') return 'followup'
  return 'first'
}

export default function OutreachPanel({ place, niche, status, senderName, contactName, onSent }: Props) {
  const [kind, setKind] = useState<MessageKind>(kindFor(status))
  const [text, setText] = useState('')
  const [copied, setCopied] = useState(false)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const whatsapp = whatsappUrl(place.phone)

  // Remonta a mensagem ao trocar o tipo ou os nomes (edições manuais valem até lá).
  const base = { place, niche, senderName, contactName }
  const baseRef = useRef(base)
  baseRef.current = base
  useEffect(() => {
    setText(buildMessage(kind, baseRef.current))
  }, [kind, place.id, niche.label, senderName, contactName])

  function markSent() {
    if (kind === 'first' && status === 'to_contact') onSent('contacted')
    if (kind === 'proposal' && status === 'interested') onSent('proposal')
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      markSent()
    } catch {
      textRef.current?.select()
    }
  }

  return (
    <div className="outreach">
      <div className="outreach-kinds" role="tablist" aria-label="Tipo de mensagem">
        {messageKinds.map((k) => (
          <button key={k.id} role="tab" aria-selected={kind === k.id} className={kind === k.id ? 'active' : ''} onClick={() => setKind(k.id)}>
            {k.label}
          </button>
        ))}
      </div>
      <textarea
        ref={textRef}
        aria-label="Mensagem"
        rows={8}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="outreach-actions">
        {whatsapp ? (
          <a className="btn btn-small btn-primary" href={whatsappWithText(whatsapp, text)} target="_blank" rel="noreferrer" onClick={markSent}>
            Enviar pelo WhatsApp ↗
          </a>
        ) : (
          <span className="muted small">Sem celular cadastrado no Google: copie e envie por outro canal.</span>
        )}
        <button className="btn btn-small btn-ghost" onClick={copy}>
          {copied ? 'Copiada!' : 'Copiar mensagem'}
        </button>
      </div>
      {status === 'to_contact' && kind === 'first' && (
        <p className="muted small">Ao enviar ou copiar, o contato passa para “Contatado”.</p>
      )}
    </div>
  )
}
