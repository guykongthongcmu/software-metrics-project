import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'
import SignupProgress from './SignupProgress.jsx'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      await apiClient.post('/auth/check-email', { email: email.trim() })
      const query = new URLSearchParams({ email: email.trim() })
      void navigate(`/auth/signup-info?${query.toString()}`)
    } catch (requestError) {
      setError(requestError?.message || 'Could not check this email. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="signup-main">
      <section className="signup-container">
        <header className="signup-header">
          <h1>Become our member</h1>
          <p>SIGN UP NOW!</p>
        </header>

        <SignupProgress activeStep={1} />

        <form className="signup-email-form" onSubmit={handleSubmit}>
          {error && <p className="signup-error-text visible" role="alert">{error}</p>}
          <div className="signup-email-group">
            <input autoComplete="email" aria-label="Email" id="signup-email" name="email" onChange={(event) => setEmail(event.target.value)} placeholder="email" required type="email" value={email} />
          </div>
          <button className="signup-next-button" disabled={isSubmitting} type="submit">{isSubmitting ? 'CHECKING…' : 'NEXT'}</button>
        </form>

        <div className="signup-footer-link">
          <p>Already a member? <Link to="/login">Log in</Link></p>
        </div>
      </section>
    </main>
  )
}
