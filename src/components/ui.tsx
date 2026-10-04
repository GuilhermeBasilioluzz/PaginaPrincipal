'use client'

import { useFormStatus } from 'react-dom'
import type { FormState } from '@/lib/types'

export function SubmitButton({ children, pendingText = 'Aguarde…', variant = 'primary' }: {
  children: React.ReactNode
  pendingText?: string
  variant?: 'primary' | 'ghost' | 'danger'
}) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className={`btn btn-${variant}`} disabled={pending} aria-busy={pending}>
      {pending ? pendingText : children}
    </button>
  )
}

export function Field({ label, name, type = 'text', hint, ...rest }: {
  label: string
  name: string
  type?: string
  hint?: string
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'name' | 'type'>) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input name={name} type={type} {...rest} />
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export function FormStatus({ state }: { state: FormState }) {
  if (!state) return null
  if (state.error) return <p className="notice notice-error" role="alert">{state.error}</p>
  if (state.message) return <p className="notice notice-ok" role="status">{state.message}</p>
  return null
}
