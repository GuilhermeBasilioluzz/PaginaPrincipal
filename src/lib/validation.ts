import { z } from 'zod'
import { isRole } from './permissions'
import { slugProblem } from './slug'

const email = z.string().trim().toLowerCase().pipe(z.email('Informe um e-mail válido.'))
const password = z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.').max(72, 'A senha é longa demais.')

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Informe a senha.'),
})

export const magicLinkSchema = z.object({ email })

export const signUpSchema = z.object({
  fullName: z.string().trim().min(2, 'Informe seu nome.').max(80, 'O nome é longo demais.'),
  email,
  password,
})

export const resetRequestSchema = z.object({ email })

export const newPasswordSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: 'As senhas não são iguais.', path: ['confirm'] })

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Informe seu nome.').max(80, 'O nome é longo demais.'),
})

export const storeSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome da loja.').max(80, 'O nome é longo demais.'),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .superRefine((value, ctx) => {
      const problem = slugProblem(value)
      if (problem) ctx.addIssue({ code: 'custom', message: problem })
    }),
})

export const addMemberSchema = z.object({
  email,
  role: z.string().refine(isRole, 'Escolha um papel.'),
})

/** Primeira mensagem de erro de um resultado do zod, pronta para mostrar na tela. */
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Dados inválidos.'
}
