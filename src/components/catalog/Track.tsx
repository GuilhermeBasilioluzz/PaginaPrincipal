'use client'

import { useEffect } from 'react'
import { sendEvent } from '@/lib/track'
import type { EventKind } from '@/lib/analytics'

/** Conta uma visualização (uma vez por visita). Não desenha nada. */
export function Track({ store, kind, refSlug = '' }: { store: string; kind: EventKind; refSlug?: string }) {
  useEffect(() => { sendEvent(store, kind, refSlug, { once: true }) }, [store, kind, refSlug])
  return null
}

/** Link que conta o toque (WhatsApp) e segue normalmente. */
export function TrackedLink({ store, kind, refSlug = '', ...rest }: { store: string; kind: EventKind; refSlug?: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  // eslint-disable-next-line jsx-a11y/anchor-has-content
  return <a {...rest} onClick={(e) => { sendEvent(store, kind, refSlug); rest.onClick?.(e) }} />
}
