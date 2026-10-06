'use client'

import { useActionState, useState } from 'react'
import { Field, FormStatus, SubmitButton } from './ui'
import { updateStoreSettingsAction } from '@/app/(app)/app/[store]/configuracoes/actions'

export type StoreSettingsValues = {
  name: string; tagline: string; description: string; whatsapp: string; instagram: string
  address: string; hours: string; accent: string; catalogEnabled: boolean; hideSoldOut: boolean
}

export function StoreSettingsForm({ storeId, slug, initial }: { storeId: string; slug: string; initial: StoreSettingsValues }) {
  const [state, action] = useActionState(updateStoreSettingsAction.bind(null, storeId, slug), undefined)
  const [v, setV] = useState(initial)
  const text = (k: 'name' | 'tagline' | 'description' | 'whatsapp' | 'instagram' | 'address' | 'hours') =>
    ({ name: k, value: v[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((p) => ({ ...p, [k]: e.target.value })) })

  return (
    <form action={action} className="stack-lg">
      <div className="stack">
        <Field label="Nome da loja" required maxLength={80} {...text('name')} />
        <Field label="Frase de apresentação" maxLength={120} placeholder="Moda feminina" hint="Aparece abaixo do nome no catálogo." {...text('tagline')} />
        <label className="field">
          <span className="field-label">Sobre a loja</span>
          <textarea rows={3} maxLength={600} {...text('description')} />
        </label>
      </div>

      <div className="stack">
        <h2>Contato</h2>
        <Field label="WhatsApp" inputMode="tel" placeholder="(84) 99999-0000" hint="É para onde vão as mensagens das clientes." autoComplete="off" {...text('whatsapp')} />
        <Field label="Instagram" placeholder="@minhaloja" hint="Pode colar o @ ou o link do perfil." autoComplete="off" {...text('instagram')} />
        <Field label="Endereço (opcional)" maxLength={200} {...text('address')} />
        <Field label="Horário de funcionamento (opcional)" maxLength={200} placeholder="Seg a sáb, 9h às 18h" {...text('hours')} />
      </div>

      <div className="stack">
        <h2>Catálogo</h2>
        <label className="check">
          <input type="checkbox" name="catalogEnabled" checked={v.catalogEnabled} onChange={(e) => setV((p) => ({ ...p, catalogEnabled: e.target.checked }))} />
          Catálogo público ligado (desmarque para tirar a loja do ar)
        </label>
        <label className="check">
          <input type="checkbox" name="hideSoldOut" checked={v.hideSoldOut} onChange={(e) => setV((p) => ({ ...p, hideSoldOut: e.target.checked }))} />
          Ocultar peças esgotadas (por padrão elas aparecem como "Esgotado")
        </label>
        <Field label="Cor de destaque (opcional)" name="accent" value={v.accent} placeholder="#C9A24A" hint="Formato #RRGGBB. Em breve será usada nos detalhes do catálogo."
          onChange={(e) => setV((p) => ({ ...p, accent: e.target.value }))} />
      </div>

      <FormStatus state={state} />
      <div><SubmitButton pendingText="Salvando…">Salvar configurações</SubmitButton></div>
    </form>
  )
}
