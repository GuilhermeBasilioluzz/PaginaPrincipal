'use client'

import { isEventKind, parseSource, type EventKind } from './analytics'

// Envia UM evento anônimo ao catálogo. Respeita "não rastrear" do navegador, conta uma vez por visita (sessão) e nunca atrapalha a página.

const ORIGIN_KEY = 'hy-o'

function origin(): string {
  try {
    const fromUrl = parseSource(new URLSearchParams(location.search).get('o'))
    if (fromUrl) { sessionStorage.setItem(ORIGIN_KEY, fromUrl); return fromUrl }
    return sessionStorage.getItem(ORIGIN_KEY) ?? ''
  } catch { return '' }
}

export function sendEvent(store: string, kind: EventKind, ref = '', opts: { once?: boolean } = {}): void {
  try {
    if (!isEventKind(kind) || navigator.doNotTrack === '1') return
    const o = origin()
    if (opts.once) {
      const key = `hy-e:${store}:${kind}:${ref}`
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    }
    void fetch('/api/evento', {
      method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ loja: store, tipo: kind, ref, origem: o }),
    }).catch(() => {})
  } catch { /* análise nunca quebra a página */ }
}
