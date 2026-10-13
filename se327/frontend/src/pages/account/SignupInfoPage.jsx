import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'
import SignupDatePicker from './SignupDatePicker.jsx'
import SignupProgress from './SignupProgress.jsx'

function localToday() {
  const date = new Date()
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function isValidDateOfBirth(value) {
  const date = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  if (!date) return false
  const parsed = new Date(Number(date[3]), Number(date[2]) - 1, Number(date[1]))
  return parsed.getFullYear() === Number(date[3])
    && parsed.getMonth() === Number(date[2]) - 1
    && parsed.getDate() === Number(date[1])
    && parsed <= localToday()
}

export default function SignupInfoPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const email = new URLSearchParams(location.search).get('email') || ''
  const [form, setForm] = useState({ name: '', surname: '', dob: '', password: '', passwordConfirm: '', countryCode: '+66', mobile: '', terms: false })
  const [visiblePasswords, setVisiblePasswords] = useState({ password: false, passwordConfirm: false })
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const mobileDigits = form.mobile.replace(/[\s-]/g, '')
  const mobileIsValid = mobileDigits.length === 0 || /^\d+$/.test(mobileDigits)
  const passwordsMatch = form.password === form.passwordConfirm
  const canContinue = form.terms && passwordsMatch && form.password.length > 0 && mobileIsValid && mobileDigits.length > 0

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function togglePassword(field) {
    setVisiblePasswords((current) => ({ ...current, [field]: !current[field] }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    const dateInput = event.currentTarget.elements.namedItem('dob')
    dateInput.setCustomValidity(form.dob && !isValidDateOfBirth(form.dob) ? 'Please enter a valid date of birth.' : '')
    if (!email || !form.name || !form.surname || !isValidDateOfBirth(form.dob) || !canContinue) return
    const [, day, month, year] = form.dob.match(/^(\d{2})\/(\d{2})\/(\d{4})$/) || []
    const phoneDigits = mobileDigits.replace(/^0/, '')
    setIsSubmitting(true)
    try {
      await apiClient.post('/auth/signup', {
        email,
        password: form.password,
        first_name: form.name.trim(),
        last_name: form.surname.trim(),
        DOB: `${year}-${month}-${day}`,
        phone_number: `${form.countryCode}${phoneDigits}`,
      })
      void navigate('/auth/signup-confirm')
    } catch (requestError) {
      setError(requestError?.message || 'Could not create your account. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="signup-main signup-info-main">
      <section className="signup-container signup-info-container">
        <header className="signup-header signup-info-header">
          <h1>Become our member</h1>
          <p>SIGN UP NOW!</p>
        </header>

        <SignupProgress activeStep={2} className="signup-progress-info" />

        <form className="signup-form signup-info-form" onSubmit={handleSubmit}>
          <input name="email" type="hidden" value={email} />
          {error && <p className="signup-error-text visible" role="alert">{error}</p>}

          <div className="signup-form-row">
            <div className="signup-form-group">
              <label htmlFor="signup-name">NAME*</label>
              <input autoComplete="given-name" id="signup-name" name="name" onChange={(event) => update('name', event.target.value)} placeholder="Enter your first name" required value={form.name} />
            </div>
            <div className="signup-form-group">
              <label htmlFor="signup-surname">SURNAME*</label>
              <input autoComplete="family-name" id="signup-surname" name="surname" onChange={(event) => update('surname', event.target.value)} placeholder="Enter your last name" required value={form.surname} />
            </div>
          </div>

          <div className="signup-form-group">
            <label htmlFor="signup-dob">DATE OF BIRTH*</label>
            <SignupDatePicker onChange={(value) => update('dob', value)} value={form.dob} />
          </div>

          <div className="signup-form-row">
            <div className="signup-form-group">
              <label htmlFor="signup-password">PASSWORD*</label>
              <div className="signup-input-with-icon">
                <input autoComplete="new-password" id="signup-password" name="password" onChange={(event) => update('password', event.target.value)} placeholder="••••••••" required type={visiblePasswords.password ? 'text' : 'password'} value={form.password} />
                <button aria-label={visiblePasswords.password ? 'Hide password' : 'Show password'} className="signup-password-toggle" onClick={() => togglePassword('password')} type="button"><SignupEye visible={visiblePasswords.password} /></button>
              </div>
            </div>
            <div className="signup-form-group">
              <label htmlFor="signup-password-confirm">PASSWORD CONFIRMATION*</label>
              <div className="signup-input-with-icon">
                <input autoComplete="new-password" className={form.passwordConfirm && !passwordsMatch ? 'error' : ''} id="signup-password-confirm" name="password_confirm" onChange={(event) => update('passwordConfirm', event.target.value)} placeholder="••••••••" required type={visiblePasswords.passwordConfirm ? 'text' : 'password'} value={form.passwordConfirm} />
                <button aria-label={visiblePasswords.passwordConfirm ? 'Hide password confirmation' : 'Show password confirmation'} className="signup-password-toggle" onClick={() => togglePassword('passwordConfirm')} type="button"><SignupEye visible={visiblePasswords.passwordConfirm} /></button>
              </div>
              <span className={`signup-error-text ${form.passwordConfirm && !passwordsMatch ? 'visible' : ''}`}>Passwords do not match</span>
            </div>
          </div>

          <div className="signup-form-group">
            <label htmlFor="signup-mobile">MOBILE NUMBER*</label>
            <div className="signup-mobile-group">
              <div className="signup-mobile-inputs">
                <div className="signup-country-code-wrapper">
                <select aria-label="Country code" name="country_code" onChange={(event) => update('countryCode', event.target.value)} value={form.countryCode}><option value="+66">+66</option></select>
                </div>
                <input className={mobileIsValid ? '' : 'error'} id="signup-mobile" name="mobile" onChange={(event) => update('mobile', event.target.value)} placeholder="XXX - XXX - XXXX" required type="tel" value={form.mobile} />
              </div>
              <span className={`signup-error-text ${mobileIsValid ? '' : 'visible'}`}>Please enter only numbers</span>
            </div>
          </div>

          <div className="signup-checkbox-group">
            <input checked={form.terms} id="signup-terms" name="terms" onChange={(event) => update('terms', event.target.checked)} required type="checkbox" />
            <label className="signup-custom-checkbox" htmlFor="signup-terms">
              <span aria-hidden="true" className="signup-checkmark" />
              <span className="signup-terms-text">I agree to the <a href="#">Membership Terms</a> and <a href="#">Privacy Policy</a>, including the collection and use of my data.</span>
            </label>
          </div>

          <button className="signup-next-button signup-continue-button" disabled={!canContinue || isSubmitting} id="continue-btn" type="submit">{isSubmitting ? 'CREATING…' : 'CONTINUE'}</button>
        </form>

        <SignupLoginLink />
      </section>
    </main>
  )
}

function SignupEye({ visible }) {
  return (
    <svg aria-hidden="true" fill="none" height="16" stroke="#A69B91" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="16">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      {!visible && <line x1="1" x2="23" y1="1" y2="23" />}
    </svg>
  )
}

export function SignupLoginLink() {
  return <div className="signup-footer-link"><p>Already a member? <Link to="/login">Log in</Link></p></div>
}
