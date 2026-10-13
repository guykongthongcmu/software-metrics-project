import { Link } from 'react-router-dom'
import SignupProgress from './SignupProgress.jsx'

export default function SignupConfirmPage() {
  return (
    <main className="signup-main signup-confirm-main">
      <section className="signup-container signup-success-container">
        <header className="signup-header signup-confirm-header">
          <h1>Become our member</h1>
          <p>SIGN UP NOW!</p>
        </header>

        <SignupProgress activeStep={3} className="signup-progress-confirm" />

        <section className="signup-success-content">
          <h2>We already sent you<br />a verification through email</h2>
          <div className="signup-mail-icon">
            <svg aria-hidden="true" height="96" viewBox="0 0 100 80" width="120" xmlns="http://www.w3.org/2000/svg">
              <rect fill="#1C1B1F" height="50" rx="6" ry="6" width="80" x="10" y="20" />
              <path d="M10 25 L50 50 L90 25" fill="none" stroke="#F8F5F0" strokeLinecap="round" strokeLinejoin="round" strokeWidth="6" />
              <path d="M10 25 L50 50 L90 25" fill="none" stroke="#1C1B1F" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              <circle cx="85" cy="15" fill="#1C1B1F" r="12" />
              <circle cx="85" cy="15" fill="#1C1B1F" r="10" stroke="#F8F5F0" strokeWidth="3" />
            </svg>
          </div>
        </section>

        <div className="signup-footer-link signup-confirm-footer">
          <p>already a member? <Link to="/login">Log in</Link></p>
        </div>
      </section>
    </main>
  )
}
