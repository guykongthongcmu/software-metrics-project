import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'
import { storefrontRoutes } from './routes.js'
import { megaMenuData } from './megaMenuData.js'

const categoryOrder = ['men', 'women', 'kids', 'baby', 'unisex']
const categoryAliases = { kid: 'kids' }

const iconPaths = {
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></>,
  account: <path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7Z" />,
  favorite: <path d="M4.3 6.3a4.5 4.5 0 0 1 6.4 0L12 7.6l1.3-1.3a4.5 4.5 0 0 1 6.4 6.4L12 20.4l-7.7-7.7a4.5 4.5 0 0 1 0-6.4Z" />,
  cart: <path d="M16 11V7a4 4 0 0 0-8 0v4M5 9h14l1 12H4L5 9Z" />,
}

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

function categorySlug(category) {
  const slug = String(category?.slug || '').trim().toLowerCase()
  return categoryAliases[slug] || slug
}

function CategoryMenu({ slug, title, open, onOpen, onClose, mobile = false }) {
  const items = megaMenuData[slug] || []
  const closeTimer = useRef(null)
  const cancelClose = () => {
    window.clearTimeout(closeTimer.current)
    closeTimer.current = null
  }
  const scheduleClose = () => {
    cancelClose()
    closeTimer.current = window.setTimeout(onClose, 240)
  }

  useEffect(() => () => window.clearTimeout(closeTimer.current), [])

  const panel = open && (
    <div className={`storefront-mega-panel ${mobile ? 'relative mt-1 max-h-[65vh] overflow-y-auto border-y border-stone-200 bg-white px-3 pb-4 pt-5' : 'fixed inset-x-0 top-24 z-60 max-h-[calc(100dvh-6rem)] overflow-y-auto border-y border-stone-200 bg-white px-5 pb-10 pt-8 shadow-[0_12px_40px_rgba(0,0,0,0.1)] sm:px-8 lg:px-12'}`} onMouseEnter={mobile ? undefined : cancelClose} onMouseLeave={mobile ? undefined : scheduleClose}>
      <button aria-label="Close category menu" className="absolute right-4 top-3 grid h-8 w-8 place-items-center text-xl leading-none text-stone-500 hover:bg-stone-100 hover:text-stone-900" onClick={onClose} type="button">×</button>
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 pt-2 sm:grid-cols-2 sm:gap-x-6 lg:grid-cols-4 lg:gap-x-8 lg:gap-y-5">
        {items.map((item) => (
          <Link className="group flex min-w-0 items-center gap-3 rounded-md px-2 py-1.5 text-[0.88rem] font-normal text-stone-800 transition-colors hover:bg-stone-100" key={`${slug}-${item.query}`} onClick={onClose} to={item.href}>
            <div className="h-13 w-13 shrink-0 overflow-hidden rounded bg-stone-100">
              <img alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" loading="lazy" onError={(event) => { event.currentTarget.style.visibility = 'hidden' }} src={item.image} />
            </div>
            <span className="leading-snug group-hover:text-stone-950">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )

  return (
    <>
      <div className="static lg:relative" onMouseEnter={mobile ? undefined : () => { cancelClose(); onOpen() }} onMouseLeave={mobile ? undefined : scheduleClose}>
        <div className="flex items-center gap-1">
          <NavLink className={({ isActive }) => `flex h-8 items-center rounded-full border text-[0.9rem] transition-colors hover:text-stone-500 ${isActive ? 'border-[#333] px-6' : 'border-transparent'}`} onClick={onClose} to={`/${slug}`}>{title}</NavLink>
          <button aria-expanded={open} aria-label={`Show ${title} categories`} className="storefront-category-toggle grid h-8 w-7 place-items-center text-stone-500 lg:hidden" onClick={onOpen} type="button">
            <svg aria-hidden="true" className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" /></svg>
          </button>
        </div>
      </div>
      {mobile ? panel : panel ? createPortal(panel, document.body) : null}
    </>
  )
}

function StorefrontHeader({ visibleCategoryRoutes }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [openCategory, setOpenCategory] = useState(null)
  const [user, setUser] = useState(null)
  const [cartCount, setCartCount] = useState(0)
  const [favoriteCount, setFavoriteCount] = useState(0)
  const [language, setLanguage] = useState('EN')

  useEffect(() => {
    let active = true
    const loadHeaderData = async () => {
      const [profileResult, cartResult, favoritesResult] = await Promise.allSettled([
        apiClient.get('/auth/user/profile', { redirectOn401: false }),
        apiClient.get('/client/cart?lang=EN', { redirectOn401: false }),
        apiClient.get('/client/favorites?lang=EN', { redirectOn401: false }),
      ])
      if (!active) return
      const headerData = {
        user: profileResult.status === 'fulfilled' ? profileResult.value?.data || null : null,
        cartCount: cartResult.status === 'fulfilled' ? Number(cartResult.value?.data?.cartSummary?.totalItems || 0) : 0,
        favoriteCount: favoritesResult.status === 'fulfilled' ? Number(favoritesResult.value?.data?.favoritesCount || 0) : 0,
      }
      setUser(headerData.user)
      setCartCount(headerData.cartCount)
      setFavoriteCount(headerData.favoriteCount)
    }
    loadHeaderData()
    window.addEventListener('storefront:refresh-header', loadHeaderData)
    window.addEventListener('focus', loadHeaderData)
    const refreshCart = (event) => setCartCount(Number(event.detail?.count ?? event.detail?.totalItems ?? 0))
    const refreshFavorites = (event) => setFavoriteCount(Number(event.detail?.count ?? event.detail?.favoritesCount ?? 0))
    window.addEventListener('storefront:cart-updated', refreshCart)
    window.addEventListener('storefront:favorites-updated', refreshFavorites)
    return () => {
      active = false
      window.removeEventListener('storefront:refresh-header', loadHeaderData)
      window.removeEventListener('focus', loadHeaderData)
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

function StorefrontFooter() {
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
            <li><a className="hover:text-accent" href="#">Sustainability</a></li>
            <li><a className="hover:text-accent" href="#">Press</a></li>
            <li><Link className="hover:text-accent" to="/contact">Contact Us</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="mb-6 text-[0.9rem] font-medium tracking-[1px] text-[#333]">MEMBERSHIP</h2>
          <p className="mb-6 text-[0.9rem]">Join now and get 15% off your first order.</p>
          <div className="flex flex-wrap gap-4">
            <Link className="rounded-full border border-accent bg-accent px-7.5 py-2 text-[0.8rem] font-medium text-white! transition-colors hover:border-[#97836d] hover:bg-[#97836d]" to="/auth/signup">SIGN UP</Link>
            <Link className="rounded-full border border-[#c4b9a9] px-7.5 py-2 text-[0.8rem] font-medium text-ink transition-colors hover:bg-black/5" to="/login">LOG IN</Link>
          </div>
        </div>
      </div>
      <div className="flex flex-col items-center justify-between gap-4 border-t border-black/5 pt-8 text-[0.8rem] sm:flex-row">
        <p>© 2026 Core & Co. All rights reserved.</p>
        <div className="flex gap-8"><a className="hover:text-accent" href="#">Privacy Policy</a><a className="hover:text-accent" href="#">Terms of Service</a></div>
      </div>
    </footer>
  )
}

export default function StorefrontLayout() {
  const location = useLocation()
  const [categories, setCategories] = useState([])
  useEffect(() => {
    let active = true
    const applyCategories = (payload) => {
      if (!active) return
      const nextCategories = payload?.data?.categories || []
      setCategories((current) => current.length === nextCategories.length
        && current.every((item, index) => item.slug === nextCategories[index]?.slug)
        ? current
        : nextCategories)
    }
    apiClient.get('/client/categories?sort=category_name&order=asc', { redirectOn401: false })
      .then(applyCategories)
      .catch(() => applyCategories({ data: { categories: [] } }))
    return () => { active = false }
  }, [])
  const visibleSlugs = new Set(categories.filter((category) => !category.isHidden).map(categorySlug))
  const visibleCategoryRoutes = categoryOrder
    .filter((slug) => visibleSlugs.has(slug))
    .map((slug) => storefrontRoutes.find((route) => route.path === `/${slug}`))
    .filter(Boolean)
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }) }, [location.pathname])
  return <div data-theme="storefront" className="min-h-screen bg-canvas text-ink"><StorefrontHeader visibleCategoryRoutes={visibleCategoryRoutes} /><Outlet /><StorefrontFooter /></div>
}