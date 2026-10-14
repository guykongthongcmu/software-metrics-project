import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiClient } from '../../../lib/apiClient.js'

export default function StorefrontFooter() {
  const navigate = useNavigate()
  const [user, setUser] = useState(undefined)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void apiClient.get('/auth/user/profile', { redirectOn401: false })
      .then((response) => { if (active) setUser(response?.data || null) })
      .catch(() => { if (active) setUser(null) })
    return () => { active = false }
  }, [])

  async function handleSignOut() {
    setError('')
    setSigningOut(true)
    try {
      await apiClient.post('/auth/logout', {}, { redirectOn401: false })
      window.dispatchEvent(new Event('storefront:refresh-header'))
      setUser(null)
      void navigate('/', { replace: true })
    } catch (requestError) {
      if (requestError?.status === 401 || requestError?.code === 'UNAUTHORIZED') {
        setUser(null)
        void navigate('/login', { replace: true })
        return
      }
      setError(requestError?.message || 'Could not sign out. Please try again.')
    } finally {
      setSigningOut(false)
    }
  }

  let membership = null
  if (user) {
    membership = (
      <>
        <p className="mb-6 text-[0.9rem]">You are currently logged in to your account.</p>
        <div className="flex">
          <button className="w-full border border-white bg-white px-7.5 py-2 text-[0.8rem] font-semibold tracking-[2px] text-[#1a1a1a] disabled:cursor-wait disabled:opacity-60" disabled={signingOut} onClick={() => { void handleSignOut() }} type="button">{signingOut ? 'LOGGING OUT…' : 'LOG OUT'}</button>
        </div>
      </>
    )
  } else if (user === null) {
    membership = (
      <>
        <p className="mb-6 text-[0.9rem]">Join now and get 15% off your first order.</p>
        <div className="flex flex-wrap gap-4">
          <Link className="rounded-full border border-accent bg-accent px-7.5 py-2 text-[0.8rem] font-medium text-white! transition-colors hover:border-[#97836d] hover:bg-[#97836d]" to="/auth/signup">SIGN UP</Link>
          <Link className="rounded-full border border-[#c4b9a9] px-7.5 py-2 text-[0.8rem] font-medium text-ink transition-colors hover:bg-black/5" to="/login">LOG IN</Link>
        </div>
      </>
    )
  }

  return (
    <footer className="bg-[#eae5d9] px-6 py-12 text-[#555] lg:px-16 lg:pt-16 lg:pb-8">
      <div className="mb-8 grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-12 lg:mb-16 lg:gap-12">
        <div>
          <h2 className="mb-6 text-[0.9rem] font-medium tracking-[1px] text-[#333]">PRODUCT</h2>
          <ul className="space-y-[0.8rem] text-[0.9rem]">
            <li><Link className="hover:text-accent" to="/men">Men</Link></li>
            <li><Link className="hover:text-accent" to="/women">Women</Link></li>
            <li><Link className="hover:text-accent" to="/kids">Kids</Link></li>
            <li><Link className="hover:text-accent" to="/baby">Baby</Link></li>
            <li><Link className="hover:text-accent" to="/unisex">Unisex</Link></li>
            <li><Link className="hover:text-accent" to="/">Home</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="mb-6 text-[0.9rem] font-medium tracking-[1px] text-[#333]">INFO</h2>
          <ul className="space-y-[0.8rem] text-[0.9rem]">
            <li><Link className="hover:text-accent" to="/about">About</Link></li>
            <li><span>Sustainability</span></li>
            <li><span>Press</span></li>
            <li><Link className="hover:text-accent" to="/contact">Contact Us</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="mb-6 text-[0.9rem] font-medium tracking-[1px] text-[#333]">MEMBERSHIP</h2>
          {membership}
          {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
        </div>
      </div>
      <div className="flex flex-col items-center justify-between gap-4 border-t border-black/5 pt-8 text-[0.8rem] sm:flex-row">
        <p>© 2026 Core & Co. All rights reserved.</p>
        <div className="flex gap-8"><span>Privacy Policy</span><span>Terms of Service</span></div>
      </div>
    </footer>
  )
}
