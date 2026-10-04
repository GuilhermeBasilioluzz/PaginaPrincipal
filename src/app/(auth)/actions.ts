'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { callbackUrl } from '@/lib/origin'
import { safeNext } from '@/lib/safeNext'
import { authErrorMessage } from '@/lib/errors'
import { firstError, loginSchema, magicLinkSchema, newPasswordSchema, resetRequestSchema, signUpSchema } from '@/lib/validation'
import type { FormState } from '@/lib/types'

const field = (fd: FormData, name: string) => String(fd.get(name) ?? '')
const RATE_LIMITED = ['over_email_send_rate_limit', 'over_request_rate_limit']

export async function signInAction(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({ email: field(fd, 'email'), password: field(fd, 'password') })
  if (!parsed.success) return { error: firstError(parsed.error) }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return { error: authErrorMessage(error) }
  redirect(safeNext(field(fd, 'next')))
}

/** Link mágico. A resposta é sempre a mesma, para não revelar quais e-mails têm conta. */
export async function magicLinkAction(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = magicLinkSchema.safeParse({ email: field(fd, 'email') })
  if (!parsed.success) return { error: firstError(parsed.error) }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { shouldCreateUser: false, emailRedirectTo: callbackUrl(safeNext(field(fd, 'next'))) },
  })
  if (error && RATE_LIMITED.includes(error.code ?? '')) return { error: authErrorMessage(error) }
  return { message: 'Se existir uma conta com este e-mail, enviamos um link de acesso. Confira sua caixa de entrada.' }
}

export async function signUpAction(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = signUpSchema.safeParse({
    fullName: field(fd, 'fullName'),
    email: field(fd, 'email'),
    password: field(fd, 'password'),
  })
  if (!parsed.success) return { error: firstError(parsed.error) }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName }, emailRedirectTo: callbackUrl('/app') },
  })
  if (error) return { error: authErrorMessage(error) }
  if (data.session) redirect('/app') // confirmação de e-mail desligada no Supabase
  return { message: 'Conta criada! Enviamos um link de confirmação para o seu e-mail. Clique nele para entrar.' }
}

/** Recuperação de senha. Também responde sempre igual. */
export async function resetRequestAction(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = resetRequestSchema.safeParse({ email: field(fd, 'email') })
  if (!parsed.success) return { error: firstError(parsed.error) }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: callbackUrl('/redefinir-senha'),
  })
  if (error && RATE_LIMITED.includes(error.code ?? '')) return { error: authErrorMessage(error) }
  return { message: 'Se existir uma conta com este e-mail, enviamos as instruções para criar uma nova senha.' }
}

export async function newPasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = newPasswordSchema.safeParse({ password: field(fd, 'password'), confirm: field(fd, 'confirm') })
  if (!parsed.success) return { error: firstError(parsed.error) }

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'O link expirou. Peça uma nova recuperação de senha.' }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) return { error: authErrorMessage(error) }
  redirect('/app')
}

export async function signOutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/entrar')
}
