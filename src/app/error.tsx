'use client'

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="hero">
      <h1>Algo deu errado</h1>
      <p className="muted">Já estamos cientes. Tente novamente em instantes.</p>
      <button className="btn btn-ghost" onClick={reset}>Tentar de novo</button>
    </main>
  )
}
