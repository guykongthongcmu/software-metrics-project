import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import SignupProgress from './SignupProgress.jsx'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const navigate = useNavigate()

  function handleSubmit(event) {
    event.preventDefault()
    const query = new URLSearchParams({ email })
    navigate(`/auth/signup-info?${query.toString()}`)
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
          <div className="signup-email-group">
            <input autoComplete="email" aria-label="Email" id="signup-email" name="email" onChange={(event) => setEmail(event.target.value)} placeholder="email" required type="email" value={email} />
          </div>
          <button className="signup-next-button" type="submit">NEXT</button>
        </form>

        <div className="signup-footer-link">
          <p>Already a member? <Link to="/login">Log in</Link></p>
        </div>
      </section>
    </main>
  )
}
