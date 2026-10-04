import Link from 'next/link'
import { Brand } from '@/components/Brand'

export default function Home() {
  return (
    <main className="hero">
      <Brand />
      <h1>Seus Stories duram 24 horas.<br /><em>Seu catálogo, não.</em></h1>
      <p className="muted">O Instagram da sua loja trabalhando por você, sempre.</p>
      <div className="row">
        <Link href="/entrar" className="btn btn-primary">Entrar</Link>
        <Link href="/cadastro" className="btn btn-ghost">Criar conta</Link>
      </div>
    </main>
  )
}
