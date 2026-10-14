import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, apiClient } from '../../lib/apiClient.js'
import ProductCard from './partials/ProductCard.jsx'
import { getColorSwatch, isLightColor } from './partials/colorSwatches.js'
import { useFavorites } from './partials/FavoritesContext.jsx'

function money(value) {
  const amount = Number(value)
  return `$${(Number.isFinite(amount) ? amount : 0).toFixed(2)}`
}

function getErrorMessage(error, fallback) {
  return error instanceof ApiError ? error.message : fallback
}

function CartItem({ item, busy, favorite, favoriteBusy, favoritesLoaded, onToggleFavorite, onQuantityChange, onRemove }) {
  const quantity = Number(item.quantityCartItem) || 1
  return (
    <article className="flex gap-4 border-b border-[#e0dbd2] py-4 first:border-t max-[575px]:gap-3">
      <Link aria-label={`View ${item.name}`} className="h-[130px] w-[100px] shrink-0 bg-[#edeae3] max-[575px]:h-[112px] max-[575px]:w-[82px]" to={`/products/${item.productId}`}>
        <img alt={item.name} className="h-full w-full object-cover" loading="lazy" src={item.image || '/images/product-placeholder.png'} />
      </Link>
      <div className="min-w-0 flex-1">
        <Link className="mb-1 block truncate text-[0.88rem] font-medium text-[#2a2520]" to={`/products/${item.productId}`}>{item.name}</Link>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-[0.68rem] tracking-[0.04em] text-[#999]">
          <span aria-label={`${item.color || 'Unknown'} colour`} className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: getColorSwatch(item.color), borderColor: isLightColor(item.color) ? '#bbb' : undefined }} />
          <span>Color: {item.color || '—'} <span aria-hidden="true">|</span> Size: {item.size || '—'}</span>
        </div>
        <div aria-label={`Quantity: ${quantity}`} className="flex h-[30px] w-fit items-center overflow-hidden rounded-full border border-[#e0dbd2] bg-white">
          <button aria-label={`Decrease ${item.name} quantity`} className="h-full w-7 text-[#2a2520] hover:bg-[#edeae3] disabled:opacity-40" disabled={busy || quantity <= 1} onClick={() => { void onQuantityChange(item, quantity - 1) }} type="button">−</button>
          <span className="grid h-full w-7 place-items-center border-x border-[#e0dbd2] text-[0.8rem] text-[#2a2520]">{quantity}</span>
          <button aria-label={`Increase ${item.name} quantity`} className="h-full w-7 text-[#2a2520] hover:bg-[#edeae3] disabled:opacity-40" disabled={busy || quantity >= 10} onClick={() => { void onQuantityChange(item, quantity + 1) }} type="button">+</button>
        </div>
      </div>
      <div className="flex w-[72px] shrink-0 items-start gap-2 pt-1 max-[575px]:w-16 max-[575px]:gap-0">
        <button aria-label={favorite ? `Remove ${item.name} from favorites` : `Add ${item.name} to favorites`} aria-pressed={favorite} className={`grid h-8 w-8 place-items-center text-[#999] transition-colors hover:text-[#2a2520] disabled:cursor-wait disabled:opacity-40 ${favorite ? 'text-[#D34B4B]' : ''}`} disabled={!favoritesLoaded || favoriteBusy} onClick={() => { void onToggleFavorite(item.productId) }} type="button">
          <svg aria-hidden="true" className="h-[18px] w-[18px]" fill={favorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path d="M4.318 6.318a4.5 4.5 0 0 0 0 6.364L12 20.364l7.682-7.682a4.5 4.5 0 0 0-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 0 0-6.364 0Z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" /></svg>
        </button>
        <button aria-label={`Remove ${item.name} from cart`} className="grid h-8 w-8 place-items-center text-[#999] transition-colors hover:text-[#c0392b] disabled:opacity-40" disabled={busy} onClick={() => { void onRemove(item) }} type="button">
          <svg aria-hidden="true" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7 18 20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 7m4 4v7m6-7v7M4 7h16m-5 0V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" /></svg>
        </button>
      </div>
      <div className="flex w-[110px] shrink-0 flex-col items-end max-[575px]:w-20">
        <div className="text-right">
          {Number(item.originalPrice) > Number(item.price) && <span className="block text-[0.72rem] text-[#999] line-through">{money(item.originalPrice)}</span>}
          <span className="text-[0.88rem] font-medium text-[#2a2520]">{money(Number(item.price) * quantity)}</span>
        </div>
      </div>
    </article>
  )
}

export default function CartPage() {
  const navigate = useNavigate()
  const { favoriteIds, busyIds: favoriteBusyIds, loaded: favoritesLoaded, toggleFavorite } = useFavorites()
  const [items, setItems] = useState([])
  const [subtotal, setSubtotal] = useState(0)
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyItemId, setBusyItemId] = useState(null)

  useEffect(() => {
    let active = true
    async function loadCart() {
      try {
        const response = await apiClient.get('/client/cart?lang=EN', { redirectOn401: false })
        if (!active) return
        const data = response?.data || {}
        const cartItems = Array.isArray(data.items) ? data.items : []
        setItems(cartItems)
        setSubtotal(Number(data.cartSummary?.subtotal) || 0)
        window.dispatchEvent(new CustomEvent('storefront:cart-updated', { detail: { count: Number(data.cartSummary?.totalItems) || 0 } }))
      } catch (requestError) {
        if (!active) return
        if (requestError instanceof ApiError && requestError.status === 401) void navigate('/login')
        else setError(getErrorMessage(requestError, 'Could not load your cart. Please try again.'))
      } finally {
        if (active) setLoading(false)
      }
    }
    async function loadRecommendations() {
      try {
        const response = await apiClient.get('/client/products/recommendations?limit=4&context=cart&lang=EN', { redirectOn401: false })
        if (active) setRecommendations(Array.isArray(response?.data?.products) ? response.data.products.slice(0, 4) : [])
      } catch {
        if (active) setRecommendations([])
      }
    }
    void loadCart()
    void loadRecommendations()
    return () => { active = false }
  }, [navigate])

  async function changeQuantity(item, quantityCartItem) {
    if (quantityCartItem < 1 || quantityCartItem > 10) return
    setBusyItemId(item.itemId)
    setError('')
    try {
      const response = await apiClient.put(`/client/cart/items/${item.itemId}?lang=EN`, { quantityCartItem }, { redirectOn401: false })
      const updatedItem = response?.data?.item
      setItems((current) => current.map((entry) => entry.itemId === item.itemId ? { ...entry, ...updatedItem } : entry))
      const total = Number(response?.data?.cartSummary?.totalItems) || 0
      setSubtotal(Number(response?.data?.cartSummary?.subtotal) || 0)
      window.dispatchEvent(new CustomEvent('storefront:cart-updated', { detail: { count: total } }))
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) void navigate('/login')
      else setError(getErrorMessage(requestError, 'Could not update quantity. Please try again.'))
    } finally {
      setBusyItemId(null)
    }
  }

  async function removeItem(item) {
    setBusyItemId(item.itemId)
    setError('')
    try {
      const response = await apiClient.delete(`/client/cart/items/${item.itemId}?lang=EN`, { redirectOn401: false })
      const summary = response?.data?.cartSummary || {}
      setItems((current) => current.filter((entry) => entry.itemId !== item.itemId))
      setSubtotal(Number(summary.subtotal) || 0)
      window.dispatchEvent(new CustomEvent('storefront:cart-updated', { detail: { count: Number(summary.totalItems) || 0 } }))
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) void navigate('/login')
      else setError(getErrorMessage(requestError, 'Could not remove this item. Please try again.'))
    } finally {
      setBusyItemId(null)
    }
  }

  const totalQuantity = items.reduce((total, item) => total + (Number(item.quantityCartItem) || 0), 0)
  return (
    <main className="min-h-[80vh] bg-[#f5f0e8] pb-10 text-[#2a2520]">
      <div className="mx-auto w-full px-3 py-6 sm:px-5 md:px-6 lg:px-12">
        <h1 className="mb-0.5 font-display text-[1.6rem] font-normal">Your cart</h1>
        <p className="mb-5 text-[0.68rem] uppercase tracking-[0.1em] text-[#999]">{loading ? 'Loading your selection…' : `${totalQuantity} item${totalQuantity === 1 ? '' : 's'} in your selection`}</p>
        {error && <p className="mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>}
        {loading && <output className="block py-8 text-sm text-[#777]">Loading cart…</output>}
        {!loading && items.length === 0 && <p className="py-4 text-[0.82rem] text-[#999]">Your cart is now empty, save the items in your cart now!</p>}
        {!loading && items.length > 0 && <section aria-label="Cart items">{items.map((item) => <CartItem busy={busyItemId === item.itemId} favorite={favoriteIds.has(Number(item.productId))} favoriteBusy={favoriteBusyIds.has(Number(item.productId))} favoritesLoaded={favoritesLoaded} item={item} key={item.itemId} onToggleFavorite={toggleFavorite} onQuantityChange={changeQuantity} onRemove={removeItem} />)}</section>}
        {!loading && <section aria-label="Cart summary" className="pt-2">
          <div className="mt-2 flex items-baseline justify-between border-t border-[#e0dbd2] py-4">
            <span className="text-[0.72rem] uppercase tracking-[0.12em] text-[#999]">Total</span>
            <span className="text-[1.2rem] font-medium">{money(subtotal)}</span>
          </div>
          <div className="flex justify-end">
            <div className="w-full max-w-[500px]">
              <button className="mb-2.5 h-[46px] w-full rounded-[4px] bg-[#b89b6e] text-[0.72rem] uppercase tracking-[0.15em] text-white transition-colors hover:bg-[#a0855a] disabled:cursor-not-allowed disabled:opacity-40" disabled={items.length === 0} onClick={() => void navigate('/checkout')} type="button">Check Out</button>
              <p className="flex items-center justify-center gap-1.5 text-[0.65rem] tracking-[0.05em] text-[#999]"><svg aria-hidden="true" className="h-[11px] w-[11px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2Zm10-10V7a4 4 0 0 0-8 0v4h8Z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>Secure encrypted checkout</p>
            </div>
          </div>
        </section>}
        {!loading && recommendations.length > 0 && <section className="mt-10">
          <h2 className="mb-4 text-[0.68rem] uppercase tracking-[0.14em] text-[#999]">You may also like</h2>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">{recommendations.map((product) => <ProductCard compact key={product.productId} product={{ ...product, colors: product.color || product.colors || [] }} showColors />)}</div>
        </section>}
      </div>
    </main>
  )
}
