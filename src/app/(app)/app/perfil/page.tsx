import { PasswordForm, ProfileForm } from '@/components/AppForms'
import { getProfile } from '@/lib/session'

export const metadata = { title: 'Meu perfil' }

export default async function ProfilePage() {
  const profile = await getProfile()
  return (
    <div className="narrow stack-lg">
      <div className="card">
        <h1>Meu perfil</h1>
        <ProfileForm fullName={profile.fullName} email={profile.email} />
      </div>
      <div className="card">
        <h2>Alterar senha</h2>
        <PasswordForm />
      </div>
    </div>
  )
}
