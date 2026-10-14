import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'
import './admin.css'

const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

function loginErrorMessage(error) {
  if (error?.status === 400) {
    return error.code === 'INVALID_EMAIL_FORMAT' ? 'Invalid email format.' : 'Check your input and try again.'
  }
  if (error?.status === 401) return 'Incorrect email or password.'
  if (error?.status === 403) return 'Your admin account is inactive. Please contact support.'
  if (error?.status === 500) return 'System error. Please try again later.'
  if (error?.status) return error.payload?.message || 'An unexpected error occurred.'
  return 'Unable to connect to the server.'
}

function wasAdminSessionExpired() {
  try {
    return window.sessionStorage.getItem('adminSessionExpired') === 'true'
  } catch {
    return false
  }
}

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [alert, setAlert] = useState('')
  const [errors, setErrors] = useState(/** @type {{ email?: string, password?: string }} */ ({}))
  const [sessionToast, setSessionToast] = useState(wasAdminSessionExpired)

  useEffect(() => {
    if (!sessionToast) return undefined
    try {
      window.sessionStorage.removeItem('adminSessionExpired')
    } catch {
      // The session notice can still expire if browser storage is unavailable.
    }
    const timeout = window.setTimeout(() => setSessionToast(false), 4000)
    return () => window.clearTimeout(timeout)
  }, [sessionToast])

  async function submit(event) {
    event.preventDefault()
    if (loading) return
    setAlert('')

    const normalizedEmail = email.trim()
    const nextErrors = {}
    if (!normalizedEmail) nextErrors.email = 'Email is required.'
    else if (!emailPattern.test(normalizedEmail)) nextErrors.email = 'Invalid email format.'
    if (!password) nextErrors.password = 'Password is required.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setLoading(true)
    try {
      const response = await apiClient.post('/auth/admin/signin', { email: normalizedEmail, password }, { redirectOn401: false })
      const adminName = response?.data?.name
      if (adminName) {
        try {
          window.sessionStorage.setItem('adminDisplayName', adminName)
        } catch {
          // Sign-in should still succeed when browser storage is unavailable.
        }
      }
      await navigate('/admin/dashboard', { replace: true })
    } catch (error) {
      setAlert(loginErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-layout" data-theme="admin">
      <div aria-hidden="true" className="admin-liquid-background">
        <span className="admin-liquid-orb admin-orb-one" />
        <span className="admin-liquid-orb admin-orb-two" />
        <span className="admin-liquid-orb admin-orb-three" />
        <span className="admin-liquid-orb admin-orb-four" />
        <span className="admin-liquid-orb admin-orb-five" />
      </div>
      {sessionToast && <div className="admin-expired-toast"><div className="admin-toast admin-toast-danger" role="status"><span aria-hidden="true" className="admin-toast-icon">!</span><div><p className="admin-toast-title">Session Expired</p><p className="admin-toast-message">Redirecting to login...</p></div></div></div>}
      <main className="admin-login-page">
        <section aria-labelledby="admin-login-heading" className="admin-login-card">
          <div className="admin-login-brand">
            <img alt="Core & Co" className="admin-login-logo" src="/images/coreandco.png" />
          </div>
          <h2 id="admin-login-heading">Admin Panel</h2>
          <p className="admin-login-subtitle">Sign in to your account</p>
          {alert && <p className="admin-login-alert" role="alert"><span aria-hidden="true">!</span>{alert}</p>}
          <form noValidate onSubmit={(event) => { void submit(event) }}>
            <div className="admin-login-field">
              <label htmlFor="admin-login-email">Email Address</label>
              <input aria-describedby={errors.email ? 'admin-email-error' : undefined} aria-invalid={Boolean(errors.email)} autoComplete="email" className={errors.email ? 'invalid' : ''} disabled={loading} id="admin-login-email" name="email" onChange={(event) => setEmail(event.target.value)} placeholder="admin@example.com" type="email" value={email} />
              {errors.email && <span className="admin-field-error" id="admin-email-error">{errors.email}</span>}
            </div>
            <div className="admin-login-field">
              <label htmlFor="admin-login-password">Password</label>
              <div className="admin-password-wrap">
                <input aria-describedby={errors.password ? 'admin-password-error' : undefined} aria-invalid={Boolean(errors.password)} autoComplete="current-password" className={errors.password ? 'invalid' : ''} disabled={loading} id="admin-login-password" name="password" onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" type={showPassword ? 'text' : 'password'} value={password} />
                <button aria-label="Toggle password visibility" aria-pressed={showPassword} className="admin-password-toggle" onClick={() => setShowPassword((visible) => !visible)} type="button">
                  <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{showPassword && <path d="m4 4 16 16" />}</svg>
                </button>
              </div>
              {errors.password && <span className="admin-field-error" id="admin-password-error">{errors.password}</span>}
            </div>
            <button className="admin-login-button" disabled={loading} type="submit">
              {loading && <span aria-hidden="true" className="admin-login-spinner" />}
              <span>{loading ? 'Signing In...' : 'Sign In'}</span>
            </button>
          </form>
        </section>
      </main>
    </div>
  )
}
