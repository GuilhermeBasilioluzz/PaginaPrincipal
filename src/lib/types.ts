import type { Role } from './permissions'

export type Store = {
  id: string
  slug: string
  name: string
  tagline: string | null
  is_active: boolean
  catalog_enabled: boolean
}

export type Membership = { role: Role; store: Store }

export type TeamMember = {
  user_id: string
  full_name: string
  email: string | null
  role: Role
  created_at: string
}

/** Estado devolvido pelas ações de formulário (useActionState). */
export type FormState = { error?: string; message?: string; link?: string; whatsapp?: string } | undefined
