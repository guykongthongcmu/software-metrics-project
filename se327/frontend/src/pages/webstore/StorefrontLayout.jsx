import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'
import { getLanguage } from '../../lib/language.js'
import { accountRoutes } from '../account/routes.js'
import { storefrontRoutes } from './routes.js'
import StorefrontFooter from './partials/StorefrontFooter.jsx'
import StorefrontHeader from './partials/StorefrontHeader.jsx'
import { FavoritesProvider } from './partials/FavoritesContext.jsx'

const categoryOrder = ['men', 'women']
const categoryAliases = { kid: 'kids' }

function categorySlug(category) {
  const slug = String(category?.slug || '').trim().toLowerCase()
  return categoryAliases[slug] || slug
}

export default function StorefrontLayout() {
  const location = useLocation()
  const isSignupPage = location.pathname.startsWith('/auth/signup')
  const hideStorefrontFooter = location.pathname === '/login'
    || location.pathname.startsWith('/auth/signup')
    || ['/forgot-password', '/forgot-password-success', '/auth/reset-password'].includes(location.pathname)
  // pages with forms keep their typed values when the language changes
  const keepPageState = hideStorefrontFooter
    || location.pathname.startsWith('/checkout')
    || location.pathname.startsWith('/account/')
  const [categories, setCategories] = useState([])
  const [language, setLanguage] = useState(getLanguage)
  useEffect(() => {
    const syncLanguage = (event) => setLanguage(event.detail.language)
    window.addEventListener('storefront:language-changed', syncLanguage)
    return () => window.removeEventListener('storefront:language-changed', syncLanguage)
  }, [])
  useEffect(() => {
    const routes = [...storefrontRoutes, ...accountRoutes]
    const route = routes.find((entry) => entry.path === location.pathname)
      || (location.pathname.startsWith('/products/') ? storefrontRoutes.find((entry) => entry.path === '/products/:id') : null)
    const query = new URLSearchParams(location.search).get('q')?.trim()
    document.title = location.pathname === '/search' && query
      ? `${query} - Search`
      : route?.documentTitle || 'Page Not Found | Core & Co'
  }, [location.pathname, location.search])
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
return (
  <div
    data-theme="storefront"
    className={`flex min-h-screen flex-col text-ink ${
      isSignupPage ? 'signup-page-shell' : 'bg-canvas'
    }`}
  >
    <StorefrontHeader visibleCategoryRoutes={visibleCategoryRoutes} />
    <FavoritesProvider key={keepPageState ? 'keep' : language}>
      <Outlet />
    </FavoritesProvider>
    {!hideStorefrontFooter && <StorefrontFooter />}
  </div>
)
}
