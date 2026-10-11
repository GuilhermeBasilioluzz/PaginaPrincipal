'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Field, FormStatus, SubmitButton } from './ui'
import {
  magicLinkAction, newPasswordAction, resetRequestAction, signInAction, signUpAction,
} from '@/app/(auth)/actions'

export function LoginForms({ next }: { next: string }) {
  const [mode, setMode] = useState<'password' | 'link'>('password')
  const [pwState, pwAction] = useActionState(signInAction, undefined)
  const [linkState, linkAction] = useActionState(magicLinkAction, undefined)

  return (
    <>
      <div className="tabs" role="tablist" aria-label="Forma de entrar">
        <button role="tab" aria-selected={mode === 'password'} onClick={() => setMode('password')} type="button">
          E-mail e senha
        </button>
        <button role="tab" aria-selected={mode === 'link'} onClick={() => setMode('link')} type="button">
          Link por e-mail
        </button>
      </div>

      {mode === 'password' ? (
        <form action={pwAction} className="stack">
          <input type="hidden" name="next" value={next} />
          <Field label="E-mail" name="email" type="email" autoComplete="email" required />
          <Field label="Senha" name="password" type="password" autoComplete="current-password" required />
          <FormStatus state={pwState} />
          <SubmitButton pendingText="Entrando…">Entrar</SubmitButton>
          <Link href="/recuperar-senha" className="link small">Esqueci minha senha</Link>
        </form>
      ) : (
        <form action={linkAction} className="stack">
          <input type="hidden" name="next" value={next} />
          <Field label="E-mail" name="email" type="email" autoComplete="email" required
            hint="Enviaremos um link para você entrar sem digitar a senha." />
          <FormStatus state={linkState} />
          <SubmitButton pendingText="Enviando…">Enviar link de acesso</SubmitButton>
        </form>
      )}
    </>
  )
}

export function SignUpForm({ next = '/app' }: { next?: string }) {
  const [state, action] = useActionState(signUpAction, undefined)
  return (
    <form action={action} className="stack">
      <input type="hidden" name="next" value={next} />
      <Field label="Seu nome" name="fullName" autoComplete="name" required />
      <Field label="E-mail" name="email" type="email" autoComplete="email" required />
      <Field label="Senha" name="password" type="password" autoComplete="new-password" minLength={8} required
        hint="Mínimo de 8 caracteres." />
      <FormStatus state={state} />
      <SubmitButton pendingText="Criando conta…">Criar conta</SubmitButton>
    </form>
  )
}

export function ResetRequestForm() {
  const [state, action] = useActionState(resetRequestAction, undefined)
  return (
    <form action={action} className="stack">
      <Field label="E-mail da sua conta" name="email" type="email" autoComplete="email" required />
      <FormStatus state={state} />
      <SubmitButton pendingText="Enviando…">Enviar instruções</SubmitButton>
    </form>
  )
}

export function NewPasswordForm() {
  const [state, action] = useActionState(newPasswordAction, undefined)
  return (
    <form action={action} className="stack">
      <Field label="Nova senha" name="password" type="password" autoComplete="new-password" minLength={8} required />
      <Field label="Repita a nova senha" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      <FormStatus state={state} />
      <SubmitButton pendingText="Salvando…">Salvar nova senha</SubmitButton>
    </form>
  )
}
