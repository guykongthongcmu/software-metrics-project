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

function ProductSection({ title, label, products, loading, error, emptyMessage }) {
  return (
    <section aria-label={label} className="mx-auto max-w-[1400px] px-4 py-12 sm:px-8 sm:py-20 lg:px-16">
      <div className="mb-8 flex items-end justify-between sm:mb-12">
        <h2 className="font-sans text-2xl font-light text-[#444]">{title}</h2>
        <a className="relative text-sm text-accent after:absolute after:-bottom-0.5 after:left-0 after:h-px after:w-full after:bg-accent" href="#">View All</a>
      </div>
      {error ? <p className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>
        : loading ? <p className="text-sm text-muted" role="status">Loading {title.toLowerCase()}…</p>
          : products.length ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 sm:gap-8 lg:grid-cols-4">{products.map((product) => <ProductCard key={product.productId} product={product} />)}</div>
            : <p className="text-sm text-muted">{emptyMessage}</p>}
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
    async function loadLandingPage() {
      try {
        const categoryPayload = await apiClient.get('/client/categories?sort=category_name&order=asc', { redirectOn401: false })
        const categories = categoryPayload?.data?.categories
        const currentCategory = Array.isArray(categories)
          ? categories.find((entry) => String(entry.slug).trim().toLowerCase() === slug)
          : null
        if (!currentCategory || currentCategory.isHidden) {
          navigate('/products', { replace: true })
          return
        }
        if (active) setCategoryLoading(false)

        let arrivals = []
        try {
          const arrivalPayload = await apiClient.get(categoryProductsUrl(slug), { redirectOn401: false })
          arrivals = Array.isArray(arrivalPayload?.data?.products) ? normalizeProducts(arrivalPayload.data.products).slice(0, 8) : []
          if (!Array.isArray(arrivalPayload?.data?.products)) throw new Error('Invalid category product response')
          if (active) setNewArrivals(arrivals)
        } catch {
          if (active) setArrivalsError('New arrivals could not be loaded. Please try again later.')
        } finally {
          if (active) setArrivalsLoading(false)
        }

        try {
          const sellerPayload = await apiClient.get(recommendationUrl(slug, arrivals), { redirectOn401: false })
          const products = sellerPayload?.data?.products
          if (!Array.isArray(products)) throw new Error('Invalid recommendations response')
          const arrivalIds = new Set(arrivals.map((product) => Number(product.productId)))
          const uniqueSellers = normalizeProducts(products)
            .filter((product) => !arrivalIds.has(Number(product.productId)))
            .slice(0, 8)
          if (active) setBestSellers(uniqueSellers)
        } catch {
          if (active) setSellersError('Best sellers could not be loaded. Please try again later.')
        } finally {
          if (active) setSellersLoading(false)
        }
      } catch {
        if (active) {
          setCategoryError('This collection could not be loaded. Please try again later.')
          setCategoryLoading(false)
          setArrivalsLoading(false)
          setSellersLoading(false)
        }
      }
    }
    void loadLandingPage()
    return () => { active = false }
  }, [navigate, slug])

  if (!content) return null

  return (
    <main>
      <HeroBanner image={content.image} title={content.title} subtitle={content.subtitle} ctaLabel="Explore Collection" ctaTo={`/search?q=${slug}`} />
      {categoryError ? <p className="mx-auto mt-8 max-w-[1400px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{categoryError}</p> : null}
      {!categoryError && !categoryLoading && <>
        <ProductSection title="New Arrivals" label="New arrivals" products={newArrivals} loading={arrivalsLoading} error={arrivalsError} emptyMessage="No new arrivals are available right now." />
        <ProductSection title="Sale" label="Best sellers" products={bestSellers} loading={sellersLoading} error={sellersError} emptyMessage="No best sellers are available right now." />
      </>}
    </main>
  )
}
