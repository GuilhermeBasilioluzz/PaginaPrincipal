import { StoreForm } from '@/components/AppForms'
import { requireUser } from '@/lib/session'

export const metadata = { title: 'Nova loja' }

export default async function NewStorePage() {
  await requireUser()
  return (
    <div className="card narrow">
      <h1>Crie sua loja</h1>
      <p className="muted">Você poderá completar logo, cores e contatos depois.</p>
      <StoreForm />
    </div>
  )
}
