import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'
import HeroBanner from './partials/HeroBanner.jsx'
import ProductCard from './partials/ProductCard.jsx'

const categoryContent = {
  men: { title: "MEN'S COLLECTION", subtitle: "MEN'S COLLECTION 2026", image: '/images/men_banner.png' },
  women: { title: "WOMEN'S COLLECTION", subtitle: "WOMEN'S COLLECTION 2026", image: '/images/women_banner.png' },
  kids: { title: "KIDS' COLLECTION", subtitle: 'KIDS COLLECTION 2026', image: '/images/kids_banner.png' },
  baby: { title: 'BABY & NEWBORN', subtitle: 'BABY COLLECTION 2026', image: '/images/baby_banner.png' },
  unisex: { title: 'UNISEX COLLECTION', subtitle: 'UNISEX COLLECTION 2026', image: '/images/unisex_banner.png' },
}

const sectionErrors = {
  arrivals: 'New arrivals could not be loaded. Please try again later.',
  sellers: 'Best sellers could not be loaded. Please try again later.',
}

function categoryProductsUrl(slug) {
  return `/client/products/category/${encodeURIComponent(slug)}?page=1&limit=8&sort=newest&lang=EN`
}

function recommendationUrl(slug, newArrivals) {
  const ids = newArrivals.map((product) => product.productId).filter((id) => id != null).join(',')
  const exclusion = ids ? `&excludeProductIds=${ids}` : ''
  return `/client/products/recommendations?category=${encodeURIComponent(slug)}&limit=8&context=category&lang=EN${exclusion}`
}

function normalizeProducts(products) {
  return products.map((product) => ({
    ...product,
    image: product.image || product.imageUrl || '/images/product-placeholder.png',
    originalPrice: product.originalPrice ?? product.compareAtPrice,
    discount: product.discount ?? product.discountPercent,
    colors: product.colors || product.color || [],
  }))
}

async function categoryIsVisible(slug) {
  const payload = await apiClient.get('/client/categories?sort=category_name&order=asc', { redirectOn401: false })
  const categories = payload?.data?.categories
  return Array.isArray(categories) && categories.some((item) => (
    String(item.slug).trim().toLowerCase() === slug && !item.isHidden
  ))
}

async function loadProducts(url, error) {
  try {
    const payload = await apiClient.get(url, { redirectOn401: false })
    const products = payload?.data?.products
    if (!Array.isArray(products)) return { products: [], error }
    return { products: normalizeProducts(products), error: '' }
  } catch {
    return { products: [], error }
  }
}

async function loadNewArrivals(slug) {
  const result = await loadProducts(categoryProductsUrl(slug), sectionErrors.arrivals)
  return { ...result, products: result.products.slice(0, 8) }
}

async function loadBestSellers(slug, arrivals) {
  const result = await loadProducts(recommendationUrl(slug, arrivals), sectionErrors.sellers)
  const arrivalIds = new Set(arrivals.map((product) => Number(product.productId)))
  const products = result.products
    .filter((product) => !arrivalIds.has(Number(product.productId)))
    .slice(0, 8)
  return { ...result, products }
}

function ProductSection({ title, label, products, loading, error, emptyMessage }) {
  let content
  if (error) {
    content = <p className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>
  } else if (loading) {
    content = <output aria-live="polite" className="block text-sm text-muted">Loading {title.toLowerCase()}…</output>
  } else if (products.length) {
    content = <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 sm:gap-8 lg:grid-cols-4">{products.map((product) => <ProductCard key={product.productId} product={product} />)}</div>
  } else {
    content = <p className="text-sm text-muted">{emptyMessage}</p>
  }

  return (
    <section aria-label={label} className="mx-auto max-w-[1400px] px-4 py-12 sm:px-8 sm:py-20 lg:px-16">
      <div className="mb-8 flex items-end justify-between sm:mb-12">
        <h2 className="font-sans text-2xl font-light text-[#444]">{title}</h2>
        <button className="relative text-sm text-accent after:absolute after:-bottom-0.5 after:left-0 after:h-px after:w-full after:bg-accent" type="button">View All</button>
      </div>
      {content}
    </section>
  )
}

export default function CategoryLandingPage({ category }) {
  const navigate = useNavigate()
  const slug = category.path.slice(1)
  const content = categoryContent[slug]
  const [newArrivals, setNewArrivals] = useState([])
  const [bestSellers, setBestSellers] = useState([])
  const [categoryLoading, setCategoryLoading] = useState(true)
  const [arrivalsLoading, setArrivalsLoading] = useState(true)
  const [sellersLoading, setSellersLoading] = useState(true)
  const [categoryError, setCategoryError] = useState('')
  const [arrivalsError, setArrivalsError] = useState('')
  const [sellersError, setSellersError] = useState('')

  useEffect(() => {
    let active = true
    const showCategoryError = () => {
      if (!active) return
      setCategoryError('This collection could not be loaded. Please try again later.')
      setCategoryLoading(false)
      setArrivalsLoading(false)
      setSellersLoading(false)
    }

    async function loadLandingPage() {
      const visible = await categoryIsVisible(slug)
      if (!active) return
      if (!visible) {
        navigate('/products', { replace: true })
        return
      }

      setCategoryLoading(false)
      const arrivalsResult = await loadNewArrivals(slug)
      if (!active) return
      setNewArrivals(arrivalsResult.products)
      setArrivalsError(arrivalsResult.error)
      setArrivalsLoading(false)

      const sellersResult = await loadBestSellers(slug, arrivalsResult.products)
      if (!active) return
      setBestSellers(sellersResult.products)
      setSellersError(sellersResult.error)
      setSellersLoading(false)
    }

    loadLandingPage().catch(showCategoryError)
    return () => { active = false }
  }, [navigate, slug])

  if (!content) return null

  let sections
  if (categoryError) {
    sections = <p className="mx-auto mt-8 max-w-[1400px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{categoryError}</p>
  } else if (!categoryLoading) {
    sections = <>
      <ProductSection title="New Arrivals" label="New arrivals" products={newArrivals} loading={arrivalsLoading} error={arrivalsError} emptyMessage="No new arrivals are available right now." />
      <ProductSection title="Sale" label="Best sellers" products={bestSellers} loading={sellersLoading} error={sellersError} emptyMessage="No best sellers are available right now." />
    </>
  }

  return (
    <main>
      <HeroBanner image={content.image} title={content.title} subtitle={content.subtitle} ctaLabel="Explore Collection" ctaTo={`/search?q=${slug}`} />
      {sections}
    </main>
  )
}
