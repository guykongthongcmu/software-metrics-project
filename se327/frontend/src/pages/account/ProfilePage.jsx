import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'
import { endMockAccountSession, getMockAccountSession, isEndpointUnavailable } from './mockAccountSession.js'

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

  useEffect(() => {
    let active = true
    apiClient.get('/auth/user/profile', { redirectOn401: false })
      .then((result) => {
        if (active) setProfile(result?.data || null)
      })
      .catch((requestError) => {
        if (!active) return
        if (isEndpointUnavailable(requestError)) {
          const demoSession = getMockAccountSession()
          if (demoSession?.profile) {
            setProfile(demoSession.profile)
            return
          }
          navigate('/login', { replace: true })
          return
        }
        if (requestError?.status === 401 || requestError?.code === 'UNAUTHORIZED') {
          navigate('/login', { replace: true })
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
      if (getMockAccountSession()) {
        endMockAccountSession()
        window.dispatchEvent(new Event('storefront:refresh-header'))
        navigate('/', { replace: true })
        return
      }
      await apiClient.post('/auth/logout', {}, { redirectOn401: false })
      window.dispatchEvent(new Event('storefront:refresh-header'))
      navigate('/', { replace: true })
    } catch (requestError) {
      if (requestError?.status === 401 || requestError?.code === 'UNAUTHORIZED') {
        navigate('/login', { replace: true })
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
    <main className="mx-auto w-full max-w-[1120px] flex-1 px-6 py-12 sm:py-16">
      <section className="mb-7 flex flex-col justify-between gap-6 rounded-[28px] border border-[#8c7e731f] bg-[radial-gradient(circle_at_top_left,rgba(195,163,124,0.24),transparent_42%),linear-gradient(135deg,rgba(255,252,248,0.96),rgba(245,239,232,0.94))] px-8 py-7 shadow-[0_22px_40px_rgba(92,72,54,0.08)] sm:flex-row sm:items-end">
        <div><p className="mb-2 text-[0.72rem] uppercase tracking-[0.22em] text-[#9c8a74]">Account</p><h1 className="font-display text-4xl font-medium text-[#5b4636] sm:text-5xl">My Profile</h1><p className="mt-3 max-w-[620px] leading-relaxed text-[#7d6a5c]">Your member details in one place, with quick access to account essentials.</p></div>
        <div className="flex flex-wrap gap-2 sm:justify-end"><span className="rounded-full border border-[#c3a37c52] bg-white/75 px-4 py-2.5 text-[0.82rem] font-semibold text-[#6f5948]">{emailVerified ? 'Email verified' : 'Verification pending'}</span><span className="rounded-full border border-[#8c7e7329] bg-white/75 px-4 py-2.5 text-[0.82rem] font-semibold text-[#8c7e73]">Member since {joinedLabel}</span></div>
      </section>

      {error && <p className="mb-5 rounded border border-[#e8b4b0] bg-[#fdf0ef] px-4 py-3 text-center text-[0.85rem] text-[#c0392b]" role="alert">{error}</p>}
      {getMockAccountSession()?.isMock && <p className="mb-5 rounded border border-[#c3a37c52] bg-white/70 px-4 py-3 text-center text-sm text-[#8c7e73]" role="status">Demo profile preview. Sign-in and account details are stored only in this browser tab.</p>}

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="flex flex-col items-start rounded-[28px] border border-[#8c7e731f] bg-[#fffdfa] p-7 shadow-[0_18px_36px_rgba(111,89,72,0.08)]">
          <div aria-hidden="true" className="mb-[18px] grid h-[84px] w-[84px] place-items-center rounded-[26px] bg-gradient-to-br from-[#ccb08a] to-[#a7825a] text-[1.8rem] font-bold tracking-[0.08em] text-white shadow-[0_16px_28px_rgba(167,130,90,0.24)]">{initials}</div>
          <h2 className="text-2xl text-[#5b4636]">{profile.name || 'Guest User'}</h2>
          <p className="mb-[22px] mt-2 text-[#8b7767]">{profile.email || 'Not provided'}</p>
          <div className="grid w-full gap-3">
            <ProfileStat label="Phone" value={profile.phone_number || 'Not provided'} />
            <ProfileStat label="Birthday" value={birthdayLabel} />
          </div>
          <button className="mt-6 w-full rounded border border-[#c7bfb6] px-4 py-3 text-sm font-semibold tracking-wide text-[#8c7e73] transition-colors hover:border-[#8c7e73] hover:bg-[#f8f5f0] disabled:cursor-wait disabled:opacity-60" disabled={isSigningOut} onClick={handleSignOut} type="button">{isSigningOut ? 'SIGNING OUT…' : 'SIGN OUT'}</button>
        </aside>

        <section className="rounded-[28px] border border-[#8c7e731f] bg-[#fffdfa] p-6 shadow-[0_18px_36px_rgba(111,89,72,0.08)] sm:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[#8c7e731f] pb-5">
            <div><p className="text-[0.72rem] uppercase tracking-[0.18em] text-[#9c8a74]">Personal information</p><h2 className="mt-1 text-xl font-semibold text-[#5b4636]">Account details</h2></div>
            <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${emailVerified ? 'bg-[#e9f3e8] text-[#47744c]' : 'bg-[#fbf1df] text-[#967245]'}`}>{emailVerified ? 'Active' : 'Verify email'}</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <ProfileDetail label="Full name" value={profile.name || 'Not provided'} note="Used for your account, order history, and checkout records." />
            <ProfileDetail label="Email address" value={profile.email || 'Not provided'} note="Your sign-in email and the destination for account updates." />
            <ProfileDetail label="Phone number" value={profile.phone_number || 'Not provided'} note="Shown here exactly as saved during signup." />
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
  return <div className="rounded-[18px] border border-[#8c7e731f] bg-[#fffdfa] p-5"><span className="text-[0.72rem] uppercase tracking-[0.15em] text-[#a58f78]">{label}</span><p className="mt-2 break-words font-semibold text-[#5e4939]">{value}</p><p className="mt-2 text-sm leading-relaxed text-[#8b7767]">{note}</p></div>
}
