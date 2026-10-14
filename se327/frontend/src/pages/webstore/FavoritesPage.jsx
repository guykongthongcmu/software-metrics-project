import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, apiClient, isUnauthorizedError } from '../../lib/apiClient.js'
import { getColorSwatch, isLightColor } from './partials/colorSwatches.js'

function money(value) {
  const amount = Number(value)
  return Number.isFinite(amount) ? `$${amount.toFixed(2)}` : '—'
}

function emitFavoriteCount(count, productId, isFavorite) {
  window.dispatchEvent(new CustomEvent('storefront:favorites-updated', { detail: { count, productId, isFavorite } }))
}

function emitCartCount(count) {
  window.dispatchEvent(new CustomEvent('storefront:cart-updated', { detail: { count } }))
}

async function loadRecommendations(favoriteIds) {
  const excluded = [...favoriteIds].join(',')
  let excludeQuery = ''
  if (excluded) excludeQuery = `&excludeProductIds=${encodeURIComponent(excluded)}`

  try {
    const response = await apiClient.get(`/client/products/recommendations?limit=4&context=favorites${excludeQuery}&lang=EN`, { redirectOn401: false })
    const products = response?.data?.products
    return Array.isArray(products) ? products.slice(0, 4) : []
  } catch {
    return []
  }
}

function handleFavoriteLoadError(requestError, navigate, setError) {
  if (isUnauthorizedError(requestError)) {
    void navigate('/login')
    return
  }
  setError(requestError instanceof ApiError ? requestError.message : 'Could not load your favorites. Please try again.')
}

function ColorDot({ color }) {
  return <span aria-label={`${color} colour`} className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: getColorSwatch(color), borderColor: isLightColor(color) ? '#bbb' : undefined }} />
}

function FavoriteCard({ product, busy, onRemove, onAddToCart }) {
  const [size, setSize] = useState('')
  const [color, setColor] = useState('')
  const sizes = Array.isArray(product.size) ? product.size : []
  const colors = Array.isArray(product.color) ? product.color : []

  return (
    <article className="flex flex-col text-[#2a2520]">
      <div className="group relative mb-[15px] aspect-[10/13] overflow-hidden bg-[#EFECE6]">
        <Link aria-label={`View ${product.name}`} className="block h-full w-full" to={`/products/${product.productId}`}>
          <img alt={product.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" src={product.image || '/images/product-placeholder.png'} />
        </Link>
        <button aria-label={`Remove ${product.name} from favorites`} className="absolute right-[15px] top-[15px] grid h-8 w-8 place-items-center rounded-full bg-white text-[#D34B4B] shadow-[0_2px_4px_rgba(0,0,0,0.05)] disabled:opacity-50" disabled={busy} onClick={() => onRemove(product)} type="button">
          <svg aria-hidden="true" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
        </button>
      </div>
      <div className="mb-[15px] flex flex-col gap-1">
        <Link className="font-display text-[1.05rem] font-normal text-[#1C1B1F] hover:underline" to={`/products/${product.productId}`}>{product.name}</Link>
        <span className="font-inter text-[0.85rem] font-medium text-[#1C1B1F]">{money(product.price)}</span>
      </div>
      <div className="mb-2 grid grid-cols-2 gap-2.5">
        <label className="sr-only" htmlFor={`favorite-size-${product.productId}`}>Select size for {product.name}</label>
        <select className="h-[42px] min-w-0 appearance-none border border-[#EAE5DF] bg-white px-[15px] font-inter text-[0.75rem] font-normal text-[#1C1B1F]" id={`favorite-size-${product.productId}`} onChange={(event) => setSize(event.target.value)} value={size}>
          <option value="">Select size</option>
          {sizes.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <label className="sr-only" htmlFor={`favorite-color-${product.productId}`}>Select colour for {product.name}</label>
        <select className="h-[42px] min-w-0 appearance-none border border-[#EAE5DF] bg-white px-[15px] font-inter text-[0.75rem] font-normal text-[#1C1B1F]" id={`favorite-color-${product.productId}`} onChange={(event) => setColor(event.target.value)} value={color}>
          <option value="">Select color</option>
          {colors.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </div>
      <div className="mt-auto flex flex-col gap-[10px]">
        <button className="min-h-[48px] w-full bg-[#1C1B1F] px-[15px] py-[14px] font-inter text-[0.75rem] font-medium tracking-[1px] text-white uppercase transition-colors hover:bg-[#333] disabled:cursor-not-allowed disabled:opacity-50" disabled={busy || !sizes.length || !colors.length} onClick={() => onAddToCart(product, color, size)} type="button">ADD TO CART</button>
      </div>
    </article>
  )
}

function RecommendationCard({ product, onToggle, favoriteIds }) {
  const isFavorite = favoriteIds.has(Number(product.productId))
  return (
    <article className="min-w-0">
      <div className="group relative mb-3 aspect-[3/4] overflow-hidden bg-[#f4f4f4]">
        <Link aria-label={`View ${product.name}`} className="block h-full w-full" to={`/products/${product.productId}`}><img alt={product.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" src={product.image || '/images/product-placeholder.png'} /></Link>
        <button aria-label={isFavorite ? `Remove ${product.name} from favorites` : `Add ${product.name} to favorites`} aria-pressed={isFavorite} className={`absolute right-[10px] top-[10px] grid h-[26px] w-[26px] place-items-center rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.05)] ${isFavorite ? 'text-[#D34B4B]' : 'text-[#A69B91]'}`} onClick={() => onToggle(product)} type="button"><svg aria-hidden="true" className="h-[14px] w-[14px]" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" strokeWidth="1.5" /></svg></button>
      </div>
      <Link className="block font-display text-[0.9rem] font-normal text-inherit" to={`/products/${product.productId}`}>{product.name}</Link>
      <p className="mt-1 font-inter text-[0.8rem] font-semibold text-[#C3A37C]">{money(product.price)}</p>
      <div aria-label={product.color?.length ? `Available colours: ${product.color.join(', ')}` : undefined} className="mt-2 flex min-h-3 gap-1.5">{(product.color || []).map((color) => <ColorDot color={color} key={color} />)}</div>
    </article>
  )
}

export default function FavoritesPage() {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [favoriteIds, setFavoriteIds] = useState(new Set())
  const [toast, setToast] = useState('')

  useEffect(() => {
    let active = true
    async function loadPage() {
      try {
        const favoriteResult = await apiClient.get('/client/favorites?lang=EN', { redirectOn401: false })
        if (!active) return
        const savedProducts = Array.isArray(favoriteResult?.data?.products) ? favoriteResult.data.products : []
        const ids = new Set(savedProducts.map((product) => Number(product.productId)))
        setProducts(savedProducts)
        setFavoriteIds(ids)
        emitFavoriteCount(Number(favoriteResult?.data?.favoritesCount ?? savedProducts.length))
        const loadedRecommendations = await loadRecommendations(ids)
        if (active) setRecommendations(loadedRecommendations)
      } catch (requestError) {
        if (active) handleFavoriteLoadError(requestError, navigate, setError)
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadPage().catch(() => { if (active) setError('Could not load your favorites. Please try again.') })
    return () => { active = false }
  }, [navigate])

  async function removeFavorite(product) {
    setBusyId(product.productId)
    setError('')
    try {
      const response = await apiClient.delete(`/client/favorites/${product.productId}?lang=EN`, { redirectOn401: false })
      const count = Number(response?.data?.favoritesCount) || 0
      setProducts((current) => current.filter((item) => Number(item.productId) !== Number(product.productId)))
      setFavoriteIds((current) => { const next = new Set(current); next.delete(Number(product.productId)); return next })
      emitFavoriteCount(count, product.productId, false)
    } catch (requestError) {
      if (isUnauthorizedError(requestError)) void navigate('/login')
      else setError(requestError instanceof ApiError ? requestError.message : 'Could not remove this favorite. Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  async function toggleFavorite(product) {
    const isFavorite = favoriteIds.has(Number(product.productId))
    setBusyId(product.productId)
    try {
      const response = isFavorite
        ? await apiClient.delete(`/client/favorites/${product.productId}?lang=EN`, { redirectOn401: false })
        : await apiClient.post(`/client/favorites/${product.productId}?lang=EN`, {}, { redirectOn401: false })
      const data = response?.data || {}
      const count = Number(data.favoritesCount) || 0
      setFavoriteIds((current) => {
        const next = new Set(current)
        if (data.isFavorite) {
          next.add(Number(product.productId))
        } else {
          next.delete(Number(product.productId))
        }
        return next
      })
      if (data.isFavorite && data.product) {
        setProducts((current) => [data.product, ...current.filter((item) => Number(item.productId) !== Number(product.productId))])
      } else if (!data.isFavorite) {
        setProducts((current) => current.filter((item) => Number(item.productId) !== Number(product.productId)))
      }
      emitFavoriteCount(count, product.productId, Boolean(data.isFavorite))
    } catch (requestError) {
      if (isUnauthorizedError(requestError)) void navigate('/login')
      else setError(requestError instanceof ApiError ? requestError.message : 'Could not update favorites. Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  async function addToCart(product, color, size) {
    if (!color || !size) {
      setError('Please select a size and color.')
      return
    }
    setBusyId(product.productId)
    setError('')
    try {
      const response = await apiClient.post('/client/cart/items?lang=EN', {
        productId: product.productId,
        color,
        size,
        quantityCartItem: 1,
      }, { redirectOn401: false })
      emitCartCount(Number(response?.data?.cartSummary?.totalItems) || 0)
      setToast(`${product.name} added to cart`)
      window.setTimeout(() => setToast(''), 3000)
    } catch (requestError) {
      if (isUnauthorizedError(requestError)) void navigate('/login')
      else setError(requestError instanceof ApiError ? requestError.message : 'Could not add to cart. Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <main className="min-h-screen flex-1 bg-[#F8F5F0] px-5 pb-20 pt-10 text-[#1C1B1F]">
      <div className="mx-auto max-w-[1000px] pt-5">
        <header className="mb-[25px] pb-[10px]">
          <h1 className="mb-2 font-inter text-[1.4rem] font-medium text-[#1C1B1F]">Favorites</h1>
        </header>
        {error && <p className="mb-5 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>}
        {loading && <output className="block py-10 text-sm text-[#777]">Loading your favorites…</output>}
        {!loading && products.length > 0 && <section aria-label="Saved favorites" className="mb-20 grid grid-cols-2 gap-[30px] lg:grid-cols-3">{products.map((product) => <FavoriteCard busy={busyId === product.productId} key={product.productId} onAddToCart={addToCart} onRemove={removeFavorite} product={product} />)}</section>}
        {!loading && !error && products.length === 0 && <section className="mb-[60px] flex flex-col items-center rounded-[4px] bg-white px-5 py-[60px] text-center shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
          <div className="mb-5"><svg aria-hidden="true" className="h-7 w-7" fill="none" stroke="#1C1B1F" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" strokeWidth="1.5" /></svg></div>
          <h2 className="mb-[15px] font-inter text-[1.1rem] font-semibold tracking-[0.5px] text-[#1C1B1F]">SAVE YOUR FAVOURITE ITEMS NOW !</h2>
          <p className="mb-10 font-inter text-[0.85rem] font-normal leading-[1.6] text-[#8C7E73]">You are absolutely able to explore your favourite items today.<br />We believe that you will experience with the good things in here.</p>
          <Link className="inline-flex min-h-0 min-w-[250px] items-center justify-center bg-[#C3A37C] px-10 py-[14px] font-inter text-[0.8rem] font-semibold tracking-[1px] text-white transition-colors hover:bg-[#b5946c]" to="/">START SHOPPING FROM MORE</Link>
        </section>}
        {!loading && recommendations.length > 0 && <section aria-label="Recommendations">
          <h2 className="mb-5 mt-10 font-inter text-[0.7rem] font-semibold tracking-[1.5px] text-[#8C7E73]">RECOMMENDATION</h2>
          <div className="grid grid-cols-2 gap-5 lg:grid-cols-4 max-[900px]:grid-cols-2">{recommendations.map((product) => <RecommendationCard favoriteIds={favoriteIds} key={product.productId} onToggle={toggleFavorite} product={product} />)}</div>
        </section>}
      </div>
      {toast && <output className="fixed bottom-7 left-1/2 z-[1000] -translate-x-1/2 rounded-sm bg-[#282521] px-6 py-3 text-sm text-white shadow-lg">{toast}</output>}
    </main>
  )
}
