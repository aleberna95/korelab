import { LoginForm } from '@/components/auth/LoginForm'

export const metadata = { title: 'Login — Command Center' }

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <LoginForm />
    </div>
  )
}
