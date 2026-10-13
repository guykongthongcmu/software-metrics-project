import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'
import ProductCard from './partials/ProductCard.jsx'
import HeroBanner from './partials/HeroBanner.jsx'

const defaultBanner = {
  image: '/images/hero_image.jpg',
  title: 'NEW COLLECTION',
  subtitle: 'SPRING/SUMMER COLLECTION 2026',
  ctaLabel: 'Explore Collection',
  ctaTo: '/products',
}

function campaignOffer(campaign) {
  if (campaign.message) return campaign.message
  if (campaign.type === 'BEST_SELLER') return 'Explore our best sellers'
  const discount = campaign.discount
  if (!discount?.value) return 'Explore the latest collection'
  if (discount.type === 'PERCENTAGE' || campaign.type === 'PERCENTAGE_DISCOUNT') return `${discount.value}% OFF`
  if (discount.type === 'FIXED' || campaign.type === 'FIXED_DISCOUNT' || campaign.type === 'FIXED_AMOUNT_DISCOUNT') return `$${discount.value} OFF`
  return 'Explore our best sellers'
}

function campaignBanner(campaign) {
  if (!campaign) return defaultBanner
  return {
    image: campaign.bannerImageUrl || campaign.bannerImage || campaign.image || '/images/current_banner.jpg',
    title: campaign.name || defaultBanner.title,
    subtitle: campaignOffer(campaign),
    ctaLabel: campaign.ctaText || defaultBanner.ctaLabel,
    ctaTo: campaign.ctaUrl || '/products',
  }
}

export default function HomePage() {
  const [products, setProducts] = useState([])
  const [productsError, setProductsError] = useState('')
  const [productsLoading, setProductsLoading] = useState(true)
  const [banner, setBanner] = useState(defaultBanner)
  const [showScrollTop, setShowScrollTop] = useState(false)

  useEffect(() => {
    let active = true
    apiClient.get('/client/products/new-arrivals', { redirectOn401: false })
      .then((payload) => {
        if (!active) return
        const arrivals = payload?.data?.products
        if (!Array.isArray(arrivals)) throw new Error('Unexpected new arrivals response')
        setProducts(arrivals.map((product) => ({
          ...product,
          image: product.image || product.imageUrl,
          originalPrice: product.originalPrice ?? product.compareAtPrice,
          discount: product.discount ?? product.discountPercent,
          colors: product.colors || product.color || [],
        })))
        setProductsError('')
      })
      .catch(() => { if (active) setProductsError('New arrivals could not be loaded. Please try again later.') })
      .finally(() => { if (active) setProductsLoading(false) })
    apiClient.get('/client/campaigns?lang=EN', { redirectOn401: false })
      .then((payload) => {
        if (!active) return
        const campaigns = payload?.data?.campaigns || (Array.isArray(payload?.data) ? payload.data : [])
        setBanner(campaignBanner(campaigns[0]))
      })
      .catch(() => { if (active) setBanner(defaultBanner) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const updateVisibility = () => setShowScrollTop(window.scrollY > 300)
    window.addEventListener('scroll', updateVisibility)
    updateVisibility()
    return () => window.removeEventListener('scroll', updateVisibility)
  }, [])

  return (
    <main>
      <HeroBanner {...banner} />

      <section className="mx-auto max-w-[1400px] px-6 py-12 sm:px-16 sm:py-20">
        <div className="mb-8 flex items-end justify-between sm:mb-12">
          <h2 className="font-sans text-2xl font-light text-[#444]">New Arrivals</h2>
          <Link to="/products?sort=newest" className="relative text-sm text-accent after:absolute after:-bottom-0.5 after:left-0 after:h-px after:w-full after:bg-accent">View All</Link>
        </div>
        {productsError ? <p role="alert" className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{productsError}</p>
          : productsLoading ? <p role="status" className="text-sm text-muted">Loading new arrivals…</p>
            : products.length ? <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">{products.map((product) => <ProductCard key={product.productId} product={product} />)}</div>
              : <p className="text-sm text-muted">No new arrivals are available right now.</p>}
      </section>

      {showScrollTop && <button type="button" aria-label="Scroll to top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="fixed bottom-8 right-8 z-[999] grid h-12 w-12 place-items-center rounded-full border-0 bg-[#8b7355] text-xl text-white">↑</button>}
    </main>
  )
}
