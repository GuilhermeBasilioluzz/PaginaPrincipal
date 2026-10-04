'use client'

import { useActionState, useState } from 'react'
import { Field, FormStatus, SubmitButton } from './ui'
import { changePasswordAction, createStoreAction, updateProfileAction } from '@/app/(app)/app/actions'
import { slugify } from '@/lib/slug'

export function StoreForm() {
  const [state, action] = useActionState(createStoreAction, undefined)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)

  return (
    <form action={action} className="stack">
      <Field label="Nome da loja" name="name" value={name} required maxLength={80}
        onChange={(e) => {
          setName(e.target.value)
          if (!slugTouched) setSlug(slugify(e.target.value))
        }} />
      <Field label="Endereço do catálogo" name="slug" value={slug} required maxLength={40}
        onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase()) }}
        hint={`Seu catálogo ficará em hyperion.system/${slug || 'sua-loja'}`} />
      <FormStatus state={state} />
      <SubmitButton pendingText="Criando loja…">Criar loja</SubmitButton>
    </form>
  )
}

export function ProfileForm({ fullName, email }: { fullName: string; email: string }) {
  const [state, action] = useActionState(updateProfileAction, undefined)
  return (
    <form action={action} className="stack">
      <Field label="Nome" name="fullName" defaultValue={fullName} required maxLength={80} />
      <Field label="E-mail" name="email" type="email" value={email} readOnly disabled hint="O e-mail não pode ser alterado por aqui." />
      <FormStatus state={state} />
      <SubmitButton pendingText="Salvando…">Salvar</SubmitButton>
    </form>
  )
}

export function PasswordForm() {
  const [state, action] = useActionState(changePasswordAction, undefined)
  return (
    <form action={action} className="stack">
      <Field label="Nova senha" name="password" type="password" autoComplete="new-password" minLength={8} required />
      <Field label="Repita a nova senha" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      <FormStatus state={state} />
      <SubmitButton pendingText="Salvando…">Alterar senha</SubmitButton>
    </form>
  )
}
