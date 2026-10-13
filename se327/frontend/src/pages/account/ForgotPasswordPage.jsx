import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      await apiClient.post('/auth/forgot-password', { email: email.trim() })
      void navigate('/forgot-password-success')
    } catch (requestError) {
      setError(requestError?.message || 'Could not connect to server')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
      <section className="flex w-full max-w-[420px] flex-col justify-center">
        <header className="mb-10 text-center">
          <h1 className="mb-3 font-display text-[2.2rem] font-medium tracking-[0.5px] text-[#8c7e73]">Forgot Password</h1>
          <p className="px-2 text-[0.85rem] leading-[1.6] text-[#a3978f]">Please enter the email address you used to create your account and we will send you a link to reset your password.</p>
        </header>
        <form className="flex flex-col" onSubmit={handleSubmit}>
          {error && <p className="mb-5 rounded border border-[#e8b4b0] bg-[#fdf0ef] px-4 py-3 text-center text-[0.82rem] text-[#c0392b]" role="alert">{error}</p>}
          <label className="mb-2 text-[0.75rem] font-semibold uppercase tracking-[1px] text-[#8c7e73]" htmlFor="forgot-email">Email *</label>
          <input autoComplete="email" className="mb-[25px] w-full rounded border border-[#e6e2db] bg-white px-5 py-4 text-[0.9rem] text-[#333] outline-none transition-colors focus:border-[#c3a37c] placeholder:text-[#d1cbc5]" id="forgot-email" onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required type="email" value={email} />
          <button className="w-full rounded bg-[#c3a37c] p-4 font-inter text-[0.85rem] font-semibold tracking-[1.5px] text-[#333] transition-colors hover:bg-[#b5946c] disabled:cursor-wait disabled:opacity-60" disabled={isSubmitting} type="submit">{isSubmitting ? 'SENDING…' : 'SUBMIT'}</button>
          <div className="mt-[25px] text-center"><Link className="text-[0.75rem] font-semibold tracking-[1px] text-[#a3978f] hover:text-[#8c7e73]" to="/login">GO BACK</Link></div>
        </form>
        <p className="mt-20 text-center text-[0.65rem] uppercase tracking-[1px] text-[#b5ac9f]">© 2026 CORE &amp; CO. ALL RIGHTS RESERVED.</p>
      </section>
    </main>
  )
}
