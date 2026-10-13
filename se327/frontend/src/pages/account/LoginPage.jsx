import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'

function getSignInError(error) {
  switch (error?.code || error?.payload?.code) {
    case 'INVALID_CREDENTIALS': return 'Invalid email or password.'
    case 'MISSING_REQUIRED_FIELDS': return 'Please fill in all required fields.'
    case 'INVALID_EMAIL_FORMAT': return 'Please enter a valid email address.'
    case 'INTERNAL_SERVER_ERROR': return 'Sign in failed. Please try again.'
    default: return error?.status ? 'Sign in failed. Please try again.' : 'Could not connect to server'
  }
}

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      await apiClient.post('/auth/user/signin', { email, password })
      window.dispatchEvent(new Event('storefront:refresh-header'))
      navigate('/')
    } catch (requestError) {
      setError(getSignInError(requestError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="signin-page flex items-center justify-center px-8 py-16">
      <section className="w-full max-w-[400px]">
        <header className="mb-10 text-center">
          <h1 className="mb-2 font-inter text-[2rem] font-semibold tracking-[2px] text-[#97836d]">SIGN IN</h1>
          <p className="text-[0.85rem] tracking-[0.5px] text-[#555]">Welcome back to your premium account</p>
        </header>

        {error && <p className="mb-6 rounded border border-[#ffcccc] bg-[#fff0f0] px-4 py-3 text-center text-[0.85rem] text-[#c00]" role="alert">{error}</p>}

        <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-[0.75rem] font-semibold tracking-[0.5px] text-[#97836d]" htmlFor="login-email">EMAIL *</label>
            <input autoComplete="email" className="w-full rounded-[4px] border border-[#eae5d9] bg-[#e8f0fe] px-4 py-[14px] text-[0.9rem] leading-[1.6] text-[#333] outline-none transition-colors focus:border-[#b5a087] placeholder:text-[#a9a9a9]" id="login-email" name="email" onChange={(event) => setEmail(event.target.value)} placeholder="Enter your email address" required type="email" value={email} />
          </div>

          <div>
            <label className="mb-2 block text-[0.75rem] font-semibold tracking-[0.5px] text-[#97836d]" htmlFor="login-password">PASSWORD *</label>
            <div className="relative">
              <input autoComplete="current-password" className="w-full rounded-[4px] border border-[#eae5d9] bg-[#e8f0fe] px-4 py-[14px] pr-12 text-[0.9rem] leading-[1.6] text-[#333] outline-none transition-colors focus:border-[#b5a087] placeholder:text-[#a9a9a9]" id="login-password" name="password" onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required type={showPassword ? 'text' : 'password'} value={password} />
              <button aria-label={showPassword ? 'Hide password' : 'Toggle password visibility'} className="absolute inset-y-0 right-4 flex items-center text-[#a9a9a9] hover:text-[#97836d]" onClick={() => setShowPassword((visible) => !visible)} type="button">
                <svg aria-hidden="true" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                  {showPassword
                    ? <><path d="M2 12s3.6-8 10-8 10 8 10 8-3.6 8-10 8S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>
                    : <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><path d="m1 1 22 22" /></>}
                </svg>
              </button>
            </div>
          </div>

          <div className="-mt-2 mb-2 flex justify-start">
            <Link className="signin-forgot-link text-[0.8rem]" to="/forgot-password">Forgot Password?</Link>
          </div>

          <button className="mt-4 w-full rounded-[4px] border border-[#b5a087] bg-[#b5a087] p-[14px] text-[0.9rem] font-medium leading-[1.6] tracking-[1px] text-white transition-all duration-300 hover:border-[#97836d] hover:bg-[#97836d] disabled:cursor-wait disabled:opacity-60" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'SIGNING IN…' : 'SIGN IN →'}
          </button>
        </form>

        <div className="mt-12 text-center">
          <p className="signin-footer text-[0.85rem]"><span>Do not have an account?</span><Link className="signin-footer-link" to="/auth/signup">Sign up now!</Link></p>
        </div>
      </section>
    </main>
  )
}
