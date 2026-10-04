'use client'

import { useFormStatus } from 'react-dom'

/** Botão de envio que pede confirmação antes (ações que não dá para desfazer). */
export function ConfirmButton({ message, children, variant = 'danger' }: {
  message: string
  children: React.ReactNode
  variant?: 'danger' | 'ghost'
}) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className={`btn btn-${variant}`} disabled={pending}
      onClick={(e) => { if (!window.confirm(message)) e.preventDefault() }}>
      {pending ? 'Aguarde…' : children}
    </button>
  )
}
