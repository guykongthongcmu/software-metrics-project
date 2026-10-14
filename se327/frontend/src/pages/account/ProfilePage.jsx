import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'
import { loginPath } from '../../lib/loginRedirect.js'

function formatProfileDate(value) {
  if (!value) return 'Not provided'
  const dateOnly = typeof value === 'string' ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null
  const parsed = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Not provided'
  return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const initials = useMemo(() => (profile?.name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'CC', [profile?.name])
  const emailVerified = Boolean(profile?.email_verified)
  const joinedLabel = formatProfileDate(profile?.created_at)
  const birthdayLabel = formatProfileDate(profile?.date_of_birth)
  const profileName = profile?.name || 'Guest User'
  const profileEmail = profile?.email || 'guest@example.com'
  const profilePhone = profile?.phone_number || 'Not provided'

  useEffect(() => {
    let active = true
    void apiClient.get('/auth/user/profile', { redirectOn401: false })
      .then((result) => {
        if (active) setProfile(result?.data || null)
      })
      .catch((requestError) => {
        if (!active) return
        if (requestError?.status === 401 || requestError?.code === 'UNAUTHORIZED') {
          void navigate(loginPath(), { replace: true })
          return
        }
        setError(requestError?.message || 'Could not load your profile')
      })
      .finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [navigate])

  async function handleSignOut() {
    setError('')
    setIsSigningOut(true)
    try {
      await apiClient.post('/auth/logout', {}, { redirectOn401: false })
      window.dispatchEvent(new Event('storefront:refresh-header'))
      void navigate('/', { replace: true })
    } catch (requestError) {
      if (requestError?.status === 401 || requestError?.code === 'UNAUTHORIZED') {
        void navigate('/login', { replace: true })
        return
      }
      setError(requestError?.message || 'Could not sign out. Please try again.')
    } finally {
      setIsSigningOut(false)
    }
  }

  if (isLoading) return <main aria-busy="true" className="flex flex-1 items-center justify-center px-6 py-16 text-sm text-muted">Loading your profile…</main>
  if (!profile) {
    return <main className="flex flex-1 items-center justify-center px-6 py-16"><p className="text-sm text-[#c0392b]" role="alert">{error || 'Could not load your profile'}</p></main>
  }

  return (
    <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 pt-8 pb-14 min-[641px]:px-6 min-[641px]:pt-12 min-[901px]:pb-[72px]">
      <section className="mb-7 flex flex-col justify-between gap-6 rounded-[28px] border border-[#8c7e731f] bg-[radial-gradient(circle_at_top_left,rgba(195,163,124,0.24),transparent_42%),linear-gradient(135deg,rgba(255,252,248,0.96),rgba(245,239,232,0.94))] px-8 py-7 shadow-[0_22px_40px_rgba(92,72,54,0.08)] max-[640px]:rounded-[22px] max-[640px]:p-[22px] min-[901px]:flex-row min-[901px]:items-end">
        <div><p className="mb-2 text-[0.72rem] uppercase tracking-[0.22em] text-[#9c8a74]">Account</p><h1 className="font-display text-[clamp(2.2rem,5vw,3.6rem)] font-medium text-[#5b4636]">My Profile</h1><p className="mt-3 max-w-[620px] leading-relaxed text-[#7d6a5c]">Your member details in one place, with quick access to account essentials.</p></div>
        <div className="flex flex-wrap gap-2 min-[901px]:justify-end"><span className="rounded-full border border-[#c3a37c52] bg-white/75 px-4 py-2.5 text-[0.82rem] font-semibold text-[#6f5948]">{emailVerified ? 'Email verified' : 'Verification pending'}</span><span className="rounded-full border border-[#8c7e7329] bg-white/75 px-4 py-2.5 text-[0.82rem] font-semibold text-[#8c7e73]">Member since {joinedLabel}</span></div>
      </section>

      {error && <p className="mb-5 rounded border border-[#e8b4b0] bg-[#fdf0ef] px-4 py-3 text-center text-[0.85rem] text-[#c0392b]" role="alert">{error}</p>}
      <div className="grid gap-6 min-[901px]:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="flex flex-col items-start rounded-[28px] border border-[#8c7e731f] bg-[#fffdfa] p-7 shadow-[0_18px_36px_rgba(111,89,72,0.08)] max-[640px]:rounded-[22px] max-[640px]:p-[22px]">
          <div aria-hidden="true" className="mb-[18px] grid h-[84px] w-[84px] place-items-center rounded-[26px] bg-gradient-to-br from-[#ccb08a] to-[#a7825a] text-[1.8rem] font-bold tracking-[0.08em] text-white shadow-[0_16px_28px_rgba(167,130,90,0.24)]">{initials}</div>
          <h2 className="m-0 text-2xl text-[#5b4636]">{profileName}</h2>
          <p className="mb-[22px] mt-2 text-[#8b7767]">{profileEmail}</p>
          <div className="grid w-full gap-3">
            <ProfileStat label="Phone" value={profilePhone} />
            <ProfileStat label="Birthday" value={birthdayLabel} />
          </div>
          <button className="mt-6 w-full rounded-2xl bg-[#1f1a17] px-[18px] py-3.5 font-semibold tracking-[0.04em] text-white transition duration-200 hover:-translate-y-px hover:bg-[#322821] disabled:cursor-wait disabled:opacity-60" disabled={isSigningOut} onClick={() => { void handleSignOut() }} type="button">{isSigningOut ? 'Signing out…' : 'Logout'}</button>
        </aside>

        <section className="rounded-[28px] border border-[#8c7e731f] bg-[#fffdfa] p-7 shadow-[0_18px_36px_rgba(111,89,72,0.08)] max-[640px]:rounded-[22px] max-[640px]:p-[22px]">
          <div className="mb-[22px] flex flex-wrap items-center justify-between gap-4 border-b border-[#8c7e731f] pb-5 max-[640px]:flex-col max-[640px]:items-start">
            <div><p className="mb-2 text-[0.72rem] uppercase tracking-[0.2em] text-[#a58f78]">Personal information</p><h2 className="m-0 font-display text-[1.9rem] font-medium text-[#5b4636]">Account details</h2></div>
            <span className={`shrink-0 rounded-full px-3.5 py-2.5 text-[0.82rem] font-bold ${emailVerified ? 'bg-[#9bc3912e] text-[#4f7654]' : 'bg-[#e5c49938] text-[#8f6d4b]'}`}>{emailVerified ? 'Active' : 'Verify email'}</span>
          </div>
          <div className="grid gap-4 min-[641px]:grid-cols-2">
            <ProfileDetail label="Full name" value={profileName} note="Used for your account, order history, and checkout records." />
            <ProfileDetail label="Email address" value={profileEmail} note="Your sign-in email and the destination for account updates." />
            <ProfileDetail label="Phone number" value={profilePhone} note="Shown here exactly as saved during signup." />
            <ProfileDetail label="Member since" value={joinedLabel} note="Tracks when your customer account was created." />
          </div>
        </section>
      </div>
    </main>
  )
}

function ProfileStat({ label, value }) {
  return <div className="rounded-[18px] bg-gradient-to-b from-[#fcf8f3] to-[#f5eee6] px-4 py-3.5"><span className="mb-2 block text-[0.76rem] uppercase tracking-[0.16em] text-[#a58f78]">{label}</span><span className="break-words font-semibold leading-relaxed text-[#5e4939]">{value}</span></div>
}

function ProfileDetail({ label, value, note }) {
  return <div className="rounded-[22px] border border-[#8c7e731a] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,242,235,0.9))] p-5"><span className="mb-2.5 block text-[0.76rem] uppercase tracking-[0.18em] text-[#aa9076]">{label}</span><p className="m-0 break-words text-[1.05rem] font-bold leading-[1.5] text-[#4f3d30]">{value}</p><p className="mt-2.5 text-[0.92rem] leading-[1.6] text-[#8a7666]">{note}</p></div>
}
