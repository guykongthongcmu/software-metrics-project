import { useEffect, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { apiClient } from '../../../lib/apiClient.js'
import { getMockAccountSession, isEndpointUnavailable, isFrontendSignedOut } from '../../account/mockAccountSession.js'
import CategoryMenu from './CategoryMenu.jsx'
import { getMockFavoriteCount } from './FavoritesContext.jsx'

const iconPaths = {
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></>,
  account: <path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7Z" />,
  favorite: <path d="M4.3 6.3a4.5 4.5 0 0 1 6.4 0L12 7.6l1.3-1.3a4.5 4.5 0 0 1 6.4 6.4L12 20.4l-7.7-7.7a4.5 4.5 0 0 1 0-6.4Z" />,
  cart: <path d="M16 11V7a4 4 0 0 0-8 0v4M5 9h14l1 12H4L5 9Z" />,
}

/** @param {{label: string, to: string, kind: string, count?: number}} props */
function IconLink({ label, to, kind, count }) {
  return (
    <Link aria-label={label} className="relative grid h-10 w-10 place-items-center text-stone-900 transition-colors hover:text-stone-500" to={to}>
      <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.55" viewBox="0 0 24 24">{iconPaths[kind]}</svg>
      {count !== undefined && <span aria-label={`${count} ${label.toLowerCase()}`} className="absolute -right-2.5 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-medium leading-none text-white">{count}</span>}
    </Link>
  )
}

function LanguageSelector({ language, onChange, mobile = false }) {
  const [open, setOpen] = useState(false)
  const selectorRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const closeOnOutsideClick = (event) => {
      if (!selectorRef.current?.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <div className={`relative ${mobile ? 'w-full border-t border-stone-200 pt-4' : ''}`} ref={selectorRef}>
      <button aria-expanded={open} aria-haspopup="menu" className={`flex items-center gap-2 rounded-sm text-[0.85rem]! font-medium text-stone-900 hover:text-stone-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${mobile ? 'w-full justify-between py-1' : 'px-1 py-2'}`} onClick={() => setOpen((value) => !value)} type="button">
        <span>{language}</span>
        <svg aria-hidden="true" className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" /></svg>
      </button>
      {open && (
        <div className={`z-60 min-w-20 rounded-lg border border-stone-200 bg-white py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.1)] ${mobile ? 'absolute left-0 top-full mt-2.5' : 'absolute right-0 top-full mt-2.5'}`} role="menu">
          {['EN', 'TH'].map((option) => (
            <button aria-current={language === option ? 'true' : undefined} className="block w-full px-5 py-2 text-center text-[0.85rem]! text-stone-800 hover:bg-stone-100" key={option} onClick={() => { onChange(option); setOpen(false) }} role="menuitem" type="button">{option}</button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function StorefrontHeader({ visibleCategoryRoutes }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [openCategory, setOpenCategory] = useState(null)
  const [user, setUser] = useState(null)
  const [cartCount, setCartCount] = useState(0)
  const [favoriteCount, setFavoriteCount] = useState(0)
  const [language, setLanguage] = useState('EN')

  useEffect(() => {
    let active = true
    const loadHeaderData = async () => {
    const demoSession = getMockAccountSession()
    const frontendSignedOut = isFrontendSignedOut()

    const [profileResult, cartResult] = await Promise.allSettled([
      demoSession
        ? Promise.resolve({ data: demoSession.profile })
        : frontendSignedOut
          ? Promise.resolve(null)
          : apiClient.get('/auth/user/profile', { redirectOn401: false }),
      apiClient.get('/client/cart?lang=EN', { redirectOn401: false }),
    ])
      if (!active) return
      const profileError = profileResult.status === 'rejected' ? profileResult.reason : null
      const canUseDemoProfile = isEndpointUnavailable(profileError)
        || profileError?.status === 401
        || profileError?.code === 'UNAUTHORIZED'
      const demoProfile = canUseDemoProfile ? getMockAccountSession()?.profile : null
      const headerData = {
        user: isFrontendSignedOut() ? null : profileResult.status === 'fulfilled' ? profileResult.value?.data || null : demoProfile || null,
        cartCount: cartResult.status === 'fulfilled' ? Number(cartResult.value?.data?.cartSummary?.totalItems || 0) : 0,
        favoriteCount: getMockFavoriteCount(),
      }
      setUser(headerData.user)
      setCartCount(headerData.cartCount)
      setFavoriteCount(headerData.favoriteCount)
    }
    void loadHeaderData()
    const refreshHeader = () => { void loadHeaderData() }
    window.addEventListener('storefront:refresh-header', refreshHeader)
    window.addEventListener('focus', refreshHeader)
    const refreshCart = (event) => setCartCount(Number(event.detail?.count ?? event.detail?.totalItems ?? 0))
    const refreshFavorites = (event) => setFavoriteCount(Number(event.detail?.count ?? event.detail?.favoritesCount ?? 0))
    window.addEventListener('storefront:cart-updated', refreshCart)
    window.addEventListener('storefront:favorites-updated', refreshFavorites)
    return () => {
      active = false
      window.removeEventListener('storefront:refresh-header', refreshHeader)
      window.removeEventListener('focus', refreshHeader)
      window.removeEventListener('storefront:cart-updated', refreshCart)
      window.removeEventListener('storefront:favorites-updated', refreshFavorites)
    }
  }, [])

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-stone-200/70 bg-canvas">
        <div className="relative mx-auto grid min-h-24 w-full grid-cols-[1fr_1fr] items-center px-5 sm:px-7 lg:px-12">
          <Link aria-label="Core & Co home" className="flex w-fit items-center" to="/">
            <img alt="Core & Co" className="h-11 w-11 object-contain sm:h-12 sm:w-12" src="/images/logo.png" />
          </Link>
          <nav aria-label="Main navigation" className="storefront-desktop-nav absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-8 lg:flex">
            <NavLink className={({ isActive }) => `flex h-8 items-center rounded-full border text-[0.9rem] transition-colors hover:text-stone-500 ${isActive ? 'border-[#333] px-6' : 'border-transparent'}`} end onClick={() => setOpenCategory(null)} to="/">Home</NavLink>
            <NavLink className={({ isActive }) => `flex h-8 items-center rounded-full border text-[0.9rem] transition-colors hover:text-stone-500 ${isActive ? 'border-[#333] px-6' : 'border-transparent'}`} onClick={() => setOpenCategory(null)} to="/products">Products</NavLink>
            {visibleCategoryRoutes.map((category) => (
              <CategoryMenu key={category.path} onClose={() => setOpenCategory((current) => current === category.path ? null : current)} onOpen={() => setOpenCategory(category.path)} open={openCategory === category.path} slug={category.path.slice(1)} title={category.title} />
            ))}
          </nav>
          <div className="flex items-center justify-end gap-0.5 sm:gap-1">
            <IconLink label="Search" kind="search" to="/search" />
            <IconLink label="Account" kind="account" to={user ? '/account/profile' : '/login'} />
            <IconLink count={favoriteCount} label="Favorites" kind="favorite" to="/favorites" />
            <IconLink count={cartCount} label="Cart" kind="cart" to="/cart" />
            <div className="hidden lg:block"><LanguageSelector language={language} onChange={setLanguage} /></div>
            <button aria-expanded={menuOpen} aria-label={menuOpen ? 'Close menu' : 'Open menu'} className="storefront-mobile-toggle ml-1 grid h-10 w-10 place-items-center text-stone-900 hover:text-stone-500 lg:hidden" onClick={() => setMenuOpen((value) => !value)} type="button">
              <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">{menuOpen ? <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" strokeWidth="1.6" /> : <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" strokeWidth="1.6" />}</svg>
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav aria-label="Mobile navigation" className="storefront-mobile-nav absolute inset-x-0 top-full z-50 max-h-[calc(100dvh-88px)] overflow-y-auto border-t border-stone-200 bg-canvas px-5 pb-6 shadow-lg lg:hidden">
            <NavLink className={({ isActive }) => `block border-b py-4 text-sm ${isActive ? 'border-stone-400 font-medium' : 'border-stone-200'}`} end onClick={() => setMenuOpen(false)} to="/">Home</NavLink>
            <NavLink className={({ isActive }) => `block border-b py-4 text-sm ${isActive ? 'border-stone-400 font-medium' : 'border-stone-200'}`} onClick={() => setMenuOpen(false)} to="/products">Products</NavLink>
            {visibleCategoryRoutes.map((category) => (
              <CategoryMenu key={category.path} mobile onClose={() => { setOpenCategory(null); setMenuOpen(false) }} onOpen={() => setOpenCategory(openCategory === category.path ? null : category.path)} open={openCategory === category.path} slug={category.path.slice(1)} title={category.title} />
            ))}
            <div className="mt-4 flex gap-4 border-t border-stone-200 pt-4 text-xs text-stone-600">
              <Link onClick={() => setMenuOpen(false)} to={user ? '/account/profile' : '/login'}>{user ? 'My account' : 'Sign in'}</Link>
              <Link onClick={() => setMenuOpen(false)} to="/about">About</Link><Link onClick={() => setMenuOpen(false)} to="/contact">Contact</Link>
            </div>
            <LanguageSelector language={language} mobile onChange={setLanguage} />
          </nav>
        )}
      </header>
      {openCategory && <button aria-label="Close category menu" className="fixed inset-0 z-30 hidden cursor-default bg-stone-950/15 lg:block" onClick={() => setOpenCategory(null)} type="button" />}
    </>
  )
}
