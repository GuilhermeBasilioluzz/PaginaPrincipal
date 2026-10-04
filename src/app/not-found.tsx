import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="hero">
      <h1>Página não encontrada</h1>
      <p className="muted">O endereço não existe ou você não tem acesso a ele.</p>
      <Link href="/" className="btn btn-ghost">Voltar ao início</Link>
    </main>
  )
}
