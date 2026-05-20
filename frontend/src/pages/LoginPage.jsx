import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { AuthCardLayout } from '@/layouts/AuthCardLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LoginPage() {
  const { login, token, loading, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from || '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  /** Drop stale Cognito tokens so refresh does not reuse an invalid JWT */
  useEffect(() => {
    if (token) logout()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (token && loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Restoring session…</p>
      </div>
    )
  }

  if (!loading && token) {
    return <Navigate to={from} replace />
  }

  async function onSubmit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await login(email, password)
      toast.success('Welcome back')
      navigate(from, { replace: true })
    } catch (err) {
      toast.error(err.message || err.response?.data?.message || 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthCardLayout title="Sign in" description="Use your Cognito user credentials.">
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          No account?{' '}
          <Link to="/register" className="text-primary hover:underline">
            Register
          </Link>
        </p>
        <p className="text-center text-sm text-muted-foreground">
          Need to verify your email?{' '}
          <Link to="/confirm" state={email.trim() ? { email: email.trim() } : undefined} className="text-primary hover:underline">
            Enter verification code
          </Link>
        </p>
      </form>
    </AuthCardLayout>
  )
}
