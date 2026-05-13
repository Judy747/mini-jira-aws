import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { AuthCardLayout } from '@/layouts/AuthCardLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function ConfirmPage() {
  const { confirmAccount, resendVerificationCode } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [resendBusy, setResendBusy] = useState(false)

  useEffect(() => {
    const fromState = location.state?.email
    if (typeof fromState === 'string' && fromState.trim()) {
      setEmail(fromState.trim())
    }
  }, [location.state])

  function validateEmail() {
    const e = email.trim()
    if (!e) {
      toast.error('Email is required')
      return false
    }
    if (!EMAIL_RE.test(e)) {
      toast.error('Enter a valid email address')
      return false
    }
    return true
  }

  function validateCode() {
    const c = code.trim()
    if (!c) {
      toast.error('Verification code is required')
      return false
    }
    if (c.length < 6 || c.length > 32) {
      toast.error('Code should be between 6 and 32 characters')
      return false
    }
    return true
  }

  async function onConfirm(e) {
    e.preventDefault()
    if (!validateEmail() || !validateCode()) return
    setConfirmBusy(true)
    try {
      await confirmAccount({ email: email.trim(), code: code.trim() })
      toast.success('Account confirmed. You can sign in.')
      navigate('/login', { replace: true })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Confirmation failed')
    } finally {
      setConfirmBusy(false)
    }
  }

  async function onResend() {
    if (!validateEmail()) return
    setResendBusy(true)
    try {
      const data = await resendVerificationCode({ email: email.trim() })
      toast.success(data?.message || 'Verification code sent.')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not resend code')
    } finally {
      setResendBusy(false)
    }
  }

  return (
    <AuthCardLayout
      title="Confirm your email"
      description="Enter the verification code we sent to your inbox. Check spam if you do not see it."
    >
      <form className="space-y-4" onSubmit={onConfirm}>
        <div className="space-y-2">
          <Label htmlFor="confirm-email">Email</Label>
          <Input
            id="confirm-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-code">Verification code</Label>
          <Input
            id="confirm-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={confirmBusy || resendBusy}>
          {confirmBusy ? 'Confirming…' : 'Confirm account'}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={onResend}
          disabled={resendBusy || confirmBusy}
        >
          {resendBusy ? 'Sending…' : 'Resend code'}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          <Link to="/login" className="text-primary hover:underline">
            Back to sign in
          </Link>
          {' · '}
          <Link to="/register" className="text-primary hover:underline">
            Register
          </Link>
        </p>
      </form>
    </AuthCardLayout>
  )
}
