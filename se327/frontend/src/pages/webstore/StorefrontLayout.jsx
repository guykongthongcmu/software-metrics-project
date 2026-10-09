import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'
import { storefrontRoutes } from './routes.js'
import { megaMenuData } from './megaMenuData.js'

const categoryOrder = ['men', 'women', 'kids', 'baby', 'unisex']
const categoryAliases = { kid: 'kids' }

const iconPaths = {
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></>,
  account: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  favorite: <path d="M20.8 8.7c0 5.2-8.8 11-8.8 11s-8.8-5.8-8.8-11A4.7 4.7 0 0 1 12 6a4.7 4.7 0 0 1 8.8 2.7Z" />,
  cart: <><path d="M3 4h2l2.2 11.1a2 2 0 0 0 2 1.6h8.9a2 2 0 0 0 2-1.6L22 8H6" /><circle cx="10" cy="21" r="1" /><circle cx="18" cy="21" r="1" /></>,
}

function IconLink({ label, to, kind, count }) {
  return (
    <Link aria-label={label} className="relative grid h-10 w-10 place-items-center rounded-full text-stone-800 transition hover:bg-stone-100" to={to}>
      <svg aria-hidden="true" className="h-[21px] w-[21px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.55" viewBox="0 0 24 24">{iconPaths[kind]}</svg>
      {count !== undefined && <span aria-label={`${count} ${label.toLowerCase()}`} className="absolute -right-0.5 -top-0.5 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-stone-900 px-1 text-[10px] font-semibold leading-none text-white">{count}</span>}
    </Link>
  )
}

function categorySlug(category) {
  const slug = String(category?.slug || '').trim().toLowerCase()
  return categoryAliases[slug] || slug
}

function CategoryMenu({ slug, title, open, onOpen, onClose, mobile = false }) {
  const items = megaMenuData[slug] || []
  return (
    <div className="static lg:relative" onMouseEnter={mobile ? undefined : onOpen} onMouseLeave={mobile ? undefined : onClose}>
      <div className="flex items-center gap-1">
        <NavLink className={({ isActive }) => `py-3 text-[13px] transition hover:text-accent ${isActive ? 'font-semibold' : ''}`} onClick={onClose} to={`/${slug}`}>{title}</NavLink>
        <button aria-expanded={open} aria-label={`Show ${title} categories`} className="storefront-category-toggle grid h-8 w-7 place-items-center text-stone-500 lg:hidden" onClick={onOpen} type="button">
          <svg aria-hidden="true" className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" /></svg>
        </button>
      </div>
      {open && (
        <div className={`storefront-mega-panel z-40 mt-1 max-h-[65vh] overflow-y-auto border-y border-stone-200 bg-white p-4 lg:absolute lg:left-1/2 lg:top-full lg:mt-0 lg:max-h-[min(72vh,680px)] lg:w-[min(100vw-48px,1100px)] lg:-translate-x-1/2 lg:rounded-b-sm lg:border lg:p-7 lg:shadow-[0_18px_45px_rgba(35,30,24,0.16)] ${mobile ? 'storefront-mega-panel-mobile' : ''}`}>
          <div className="mb-5 flex items-center justify-between border-b border-stone-100 pb-3">
            <div><p className="font-display text-xl">{title}</p><Link className="mt-1 inline-block text-xs text-stone-500 underline underline-offset-4" onClick={onClose} to={`/${slug}`}>Shop all {title.toLowerCase()}</Link></div>
            <button aria-label="Close category menu" className="grid h-9 w-9 place-items-center rounded-full hover:bg-stone-100" onClick={onClose} type="button">×</button>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {items.map((item) => (
              <Link className="group min-w-0" key={`${slug}-${item.query}`} onClick={onClose} to={item.href}>
                <div className="aspect-[4/3] overflow-hidden bg-stone-100">
                  <img alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" loading="lazy" onError={(event) => { event.currentTarget.style.visibility = 'hidden' }} src={item.image} />
                </div>
                <span className="mt-2 block text-xs leading-snug text-stone-700 group-hover:text-stone-950">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StorefrontHeader({ visibleCategoryRoutes }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [openCategory, setOpenCategory] = useState(null)
  const [user, setUser] = useState(null)
  const [cartCount, setCartCount] = useState(0)
  const [favoriteCount, setFavoriteCount] = useState(0)

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
      <header className="relative z-50 border-b border-stone-200/80 bg-[var(--ui-canvas)]">
        <div className="mx-auto grid min-h-[78px] max-w-[1440px] grid-cols-[auto_1fr_auto] items-center gap-3 px-4 sm:px-7 lg:px-10">
          <Link aria-label="Core & Co home" className="flex w-fit items-center" to="/">
            <img alt="Core & Co" className="h-[48px] w-[48px] object-contain sm:h-[54px] sm:w-[54px]" src="/images/logo.png" />
          </Link>
          <nav aria-label="Main navigation" className="storefront-desktop-nav hidden items-center justify-center gap-5 lg:flex xl:gap-7">
            <NavLink className={({ isActive }) => `py-3 text-[13px] ${isActive ? 'font-semibold' : ''}`} end onClick={() => setOpenCategory(null)} to="/">Home</NavLink>
            <NavLink className={({ isActive }) => `py-3 text-[13px] ${isActive ? 'font-semibold' : ''}`} onClick={() => setOpenCategory(null)} to="/products">Products</NavLink>
            {visibleCategoryRoutes.map((category) => (
              <CategoryMenu key={category.path} onClose={() => setOpenCategory(null)} onOpen={() => setOpenCategory(category.path)} open={openCategory === category.path} slug={category.path.slice(1)} title={category.title} />
            ))}
          </nav>
          <div className="flex items-center justify-end gap-0.5 sm:gap-1">
            <IconLink label="Search" kind="search" to="/search" />
            <IconLink label="Account" kind="account" to={user ? '/account/profile' : '/login'} />
            <IconLink count={favoriteCount} label="Favorites" kind="favorite" to="/favorites" />
            <IconLink count={cartCount} label="Cart" kind="cart" to="/cart" />
            <button aria-expanded={menuOpen} aria-label={menuOpen ? 'Close menu' : 'Open menu'} className="storefront-mobile-toggle ml-1 grid h-10 w-10 place-items-center rounded-full hover:bg-stone-100 lg:hidden" onClick={() => setMenuOpen((value) => !value)} type="button">
              <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">{menuOpen ? <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" strokeWidth="1.6" /> : <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" strokeWidth="1.6" />}</svg>
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav aria-label="Mobile navigation" className="storefront-mobile-nav absolute inset-x-0 top-full z-50 max-h-[calc(100dvh-78px)] overflow-y-auto border-t border-stone-200 bg-[var(--ui-canvas)] px-5 pb-6 shadow-lg lg:hidden">
            <NavLink className="block border-b border-stone-200 py-4 text-sm" end onClick={() => setMenuOpen(false)} to="/">Home</NavLink>
            <NavLink className="block border-b border-stone-200 py-4 text-sm" onClick={() => setMenuOpen(false)} to="/products">Products</NavLink>
            {visibleCategoryRoutes.map((category) => (
              <CategoryMenu key={category.path} mobile onClose={() => { setOpenCategory(null); setMenuOpen(false) }} onOpen={() => setOpenCategory(openCategory === category.path ? null : category.path)} open={openCategory === category.path} slug={category.path.slice(1)} title={category.title} />
            ))}
            <div className="mt-4 flex gap-4 border-t border-stone-200 pt-4 text-xs text-stone-600">
              <Link onClick={() => setMenuOpen(false)} to={user ? '/account/profile' : '/login'}>{user ? 'My account' : 'Sign in'}</Link>
              <Link onClick={() => setMenuOpen(false)} to="/about">About</Link><Link onClick={() => setMenuOpen(false)} to="/contact">Contact</Link>
            </div>
          </nav>
        )}
      </header>
      {openCategory && <button aria-label="Close category menu" className="fixed inset-0 z-30 hidden cursor-default bg-stone-950/15 lg:block" onClick={() => setOpenCategory(null)} type="button" />}
    </>
  )
}

function StorefrontFooter({ visibleCategoryRoutes }) {
  return (
    <footer className="mt-12 border-t border-stone-300 bg-[#eae5d9]">
      <div className="mx-auto grid max-w-[1280px] gap-10 px-5 py-12 sm:grid-cols-2 sm:px-8 lg:grid-cols-[1fr_1fr_1.25fr] lg:gap-16 lg:py-16">
        <div>
          <h2 className="mb-4 text-[11px] font-semibold tracking-[0.14em]">PRODUCT</h2>
          <ul className="space-y-2 text-sm text-stone-700">
            {visibleCategoryRoutes.map((entry) => <li key={entry.path}><Link className="hover:underline" to={entry.path}>{entry.title}</Link></li>)}
            <li><Link className="hover:underline" to="/">Home</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="mb-4 text-[11px] font-semibold tracking-[0.14em]">INFO</h2>
          <ul className="space-y-2 text-sm text-stone-700"><li><Link className="hover:underline" to="/about">About</Link></li><li><a className="hover:underline" href="mailto:coreandco2026@gmail.com">Sustainability</a></li><li><Link className="hover:underline" to="/contact">Contact Us</Link></li></ul>
        </div>
        <div>
          <h2 className="mb-3 text-[11px] font-semibold tracking-[0.14em]">MEMBERSHIP</h2>
          <p className="max-w-sm text-sm leading-relaxed text-stone-700">Join now and get 15% off your first order.</p>
          <div className="mt-5 flex flex-wrap gap-3"><Link className="bg-stone-900 px-5 py-3 text-[11px] font-semibold tracking-[0.12em] text-white hover:bg-stone-700" to="/auth/signup">SIGN UP</Link><Link className="border border-stone-500 px-5 py-3 text-[11px] font-semibold tracking-[0.12em] hover:bg-white/50" to="/login">LOG IN</Link></div>
        </div>
      </div>
      <div className="mx-auto flex max-w-[1280px] flex-col gap-3 border-t border-stone-400/40 px-5 py-5 text-xs text-stone-600 sm:flex-row sm:items-center sm:justify-between sm:px-8"><p>© 2026 Core & Co. All rights reserved.</p><div className="flex gap-5"><a href="#privacy">Privacy Policy</a><a href="#terms">Terms of Service</a></div></div>
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
  return <div data-theme="storefront" className="min-h-screen bg-canvas text-ink"><StorefrontHeader visibleCategoryRoutes={visibleCategoryRoutes} /><Outlet /><StorefrontFooter visibleCategoryRoutes={visibleCategoryRoutes} /></div>
}