import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')?.trim() || ''
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (!token) {
      setError('This password reset link is missing its token. Request a new link.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setIsSubmitting(true)
    try {
      await apiClient.post('/auth/reset-password', {
        token,
        new_password: newPassword,
        confirm_password: confirmPassword,
      })
      void navigate('/login')
    } catch (requestError) {
      setError(requestError?.message || 'Could not reset password')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
      <section className="flex w-full max-w-[420px] flex-col justify-center">
        <header className="mb-10 text-center">
          <h1 className="mb-3 font-display text-[2.2rem] font-medium tracking-[0.5px] text-[#8c7e73]">Reset Password</h1>
          <p className="text-[0.85rem] leading-[1.6] text-[#a3978f]">Enter your new password below.</p>
        </header>
        <form className="flex flex-col" onSubmit={handleSubmit}>
          {error && <p className="mb-5 rounded border border-[#e8b4b0] bg-[#fdf0ef] px-4 py-3 text-center text-[0.82rem] text-[#c0392b]" role="alert">{error}</p>}
          <label className="mb-2 text-[0.75rem] font-semibold uppercase tracking-[1px] text-[#8c7e73]" htmlFor="new-password">New Password *</label>
          <input autoComplete="new-password" className="mb-[25px] w-full rounded border border-[#e6e2db] bg-white px-5 py-4 text-[0.9rem] text-[#333] outline-none transition-colors focus:border-[#c3a37c] placeholder:text-[#d1cbc5]" id="new-password" minLength={8} onChange={(event) => setNewPassword(event.target.value)} placeholder="At least 8 characters" required type="password" value={newPassword} />
          <label className="mb-2 text-[0.75rem] font-semibold uppercase tracking-[1px] text-[#8c7e73]" htmlFor="confirm-password">Confirm Password *</label>
          <input autoComplete="new-password" className="mb-[25px] w-full rounded border border-[#e6e2db] bg-white px-5 py-4 text-[0.9rem] text-[#333] outline-none transition-colors focus:border-[#c3a37c] placeholder:text-[#d1cbc5]" id="confirm-password" minLength={8} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repeat your password" required type="password" value={confirmPassword} />
          <button className="w-full rounded bg-[#c3a37c] p-4 font-inter text-[0.85rem] font-semibold tracking-[1.5px] text-[#333] transition-colors hover:bg-[#b5946c] disabled:cursor-wait disabled:opacity-60" disabled={isSubmitting} type="submit">{isSubmitting ? 'RESETTING…' : 'RESET PASSWORD'}</button>
          <div className="mt-[25px] text-center"><Link className="text-[0.75rem] font-semibold tracking-[1px] text-[#a3978f] hover:text-[#8c7e73]" to="/login">GO BACK</Link></div>
        </form>
        <p className="mt-20 text-center text-[0.65rem] uppercase tracking-[1px] text-[#b5ac9f]">© 2026 CORE &amp; CO. ALL RIGHTS RESERVED.</p>
      </section>
    </main>
  )
}
