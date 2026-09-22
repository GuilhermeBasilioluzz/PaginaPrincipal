import { useState } from 'react'
import PlanCard from '../components/PlanCard'
import { lifetimePlan, monthlyPlan } from '../config/plans'
import type { AccessRow } from '../lib/access'

interface Props {
  email: string
  access: AccessRow | null
  onRefresh: () => Promise<void>
  onSignOut: () => void
}

function reason(access: AccessRow | null): string {
  if (!access) return 'Ainda não encontramos uma compra com este e-mail.'
  if (access.status === 'revoked') return 'O acesso deste e-mail foi encerrado após reembolso ou contestação do pagamento.'
  return 'A sua assinatura mensal expirou. Renove para continuar usando o PromptForge.'
}

export default function NoAccess({ email, access, onRefresh, onSignOut }: Props) {
  const [checking, setChecking] = useState(false)

  async function check() {
    setChecking(true)
    await onRefresh()
    setChecking(false)
  }

  return (
    <section className="no-access">
      <p className="eyebrow">Conectado como {email}</p>
      <h2 className="screen-title">Falta liberar o seu acesso</h2>
      <p className="muted">{reason(access)}</p>

      <div className="plans">
        <PlanCard plan={lifetimePlan} featured />
        <PlanCard plan={monthlyPlan} />
      </div>

      <div className="card notice">
        <div>
          <strong>Já pagou?</strong>
          <p className="muted">
            A liberação é automática e costuma levar poucos minutos (no Pix, logo após a confirmação). Confira se a compra
            foi feita com o e-mail <strong>{email}</strong>.
          </p>
        </div>
        <div className="notice-actions">
          <button className="btn btn-primary" onClick={check} disabled={checking}>
            {checking ? 'Verificando…' : 'Verificar de novo'}
          </button>
          <button className="link" onClick={onSignOut}>
            Entrar com outro e-mail
          </button>
        </div>
      </div>
    </section>
  )
}
