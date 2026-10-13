import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'
import { accountRoutes } from '../account/routes.js'
import { storefrontRoutes } from './routes.js'
import StorefrontFooter from './partials/StorefrontFooter.jsx'
import StorefrontHeader from './partials/StorefrontHeader.jsx'

const categoryOrder = ['men', 'women', 'kids', 'baby', 'unisex']
const categoryAliases = { kid: 'kids' }

function categorySlug(category) {
  const slug = String(category?.slug || '').trim().toLowerCase()
  return categoryAliases[slug] || slug
}

export default function StorefrontLayout() {
  const location = useLocation()
  const [categories, setCategories] = useState([])
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
  return <div data-theme="storefront" className="min-h-screen bg-canvas text-ink"><StorefrontHeader visibleCategoryRoutes={visibleCategoryRoutes} /><Outlet /><StorefrontFooter /></div>
}