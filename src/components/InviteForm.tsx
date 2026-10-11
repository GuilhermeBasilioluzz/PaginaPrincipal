'use client'

import { useActionState, useState } from 'react'
import { Field, FormStatus, SubmitButton } from './ui'
import { createInviteAction } from '@/app/(app)/app/[store]/equipe/invite-actions'
import { INVITE_DAYS, INVITE_USES } from '@/lib/invites'
import { ROLE_LABEL } from '@/lib/permissions'
import { copyText } from '@/lib/share'

export function InviteForm({ storeId, slug, storeName }: { storeId: string; slug: string; storeName: string }) {
  const [state, action] = useActionState(createInviteAction.bind(null, storeId, slug, storeName), undefined)
  const [copied, setCopied] = useState(false)

  return (
    <div className="stack">
      <form action={action} className="stack">
        <div className="grid-2">
          <label className="field">
            <span className="field-label">Papel</span>
            <select name="role" defaultValue="attendant">
              <option value="attendant">{ROLE_LABEL.attendant}</option>
              <option value="manager">{ROLE_LABEL.manager}</option>
            </select>
          </label>
          <Field label="Para quem? (opcional)" name="label" maxLength={80} placeholder="Ana, vendedora" hint="Só para você identificar o convite." />
        </div>
        <div className="grid-2">
          <label className="field"><span className="field-label">Validade</span>
            <select name="days" defaultValue="7">{Object.entries(INVITE_DAYS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="field"><span className="field-label">Quantas pessoas podem usar</span>
            <select name="uses" defaultValue="1">{Object.entries(INVITE_USES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        </div>
        {!state?.link && <FormStatus state={state} />}
        <div><SubmitButton pendingText="Criando…">Criar convite</SubmitButton></div>
      </form>

      {state?.link && (
        <div className="card stack" style={{ borderColor: 'var(--bronze)' }} role="status">
          <p className="notice notice-ok" style={{ margin: 0 }}>{state.message}</p>
          <input readOnly value={state.link} aria-label="Link do convite" onFocus={(e) => e.currentTarget.select()} />
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={async () => { setCopied(await copyText(state.link!)); setTimeout(() => setCopied(false), 2500) }}>
              {copied ? 'Link copiado!' : 'Copiar link'}
            </button>
            {state.whatsapp && <a className="btn btn-ghost" href={state.whatsapp} target="_blank" rel="noopener noreferrer">Enviar no WhatsApp</a>}
          </div>
        </div>
      )}
    </div>
  )
}
