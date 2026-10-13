import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError, apiClient } from '../../lib/apiClient.js'
import ProductCard from './partials/ProductCard.jsx'
import { getColorSwatch, isLightColor } from './partials/colorSwatches.js'
const deliveryText = 'Free standard delivery on orders over $100. Returns accepted within 30 days.'

function money(value) {
  const amount = Number(value)
  return Number.isFinite(amount) ? `$${amount.toFixed(2)}` : '—'
}

function unique(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))]
}

function getPageState(id, loadedId, error, errorId, product) {
  if (loadedId !== id) return 'loading'
  if ((error && errorId === id) || !product) return 'error'
  return 'ready'
}

function getPageErrorMessage(id, error, errorId) {
  return errorId === id ? error : 'This product could not be loaded.'
}

function getCartButtonLabel(canAddToCart, busy) {
  if (!canAddToCart) return 'Out of Stock'
  if (busy) return 'Please wait…'
  return 'Add to Cart'
}

function flyToCart(originElement, onComplete) {
  const cartIcon = document.querySelector('.cart-link')
  if (!cartIcon || !originElement) {
    onComplete()
    return
  }

  const origin = originElement.getBoundingClientRect()
  const target = cartIcon.getBoundingClientRect()
  const fabric = document.createElement('div')
  fabric.setAttribute('aria-hidden', 'true')
  fabric.innerHTML = '<svg viewBox="0 0 40 50" fill="none" xmlns="http://www.w3.org/2000/svg" width="40" height="50"><rect x="4" y="2" width="32" height="42" rx="3" fill="#c4b49a" opacity="0.9"/><line x1="4" y1="10" x2="36" y2="10" stroke="#a09070" stroke-width="1.5"/><line x1="4" y1="18" x2="36" y2="18" stroke="#a09070" stroke-width="1"/><line x1="4" y1="26" x2="36" y2="26" stroke="#a09070" stroke-width="1"/><line x1="14" y1="2" x2="14" y2="44" stroke="#a09070" stroke-width="0.8" opacity="0.5"/><line x1="26" y1="2" x2="26" y2="44" stroke="#a09070" stroke-width="0.8" opacity="0.5"/></svg>'

  const startX = origin.left + origin.width / 2 - 20
  const startY = origin.top + origin.height / 2 - 25
  const endX = target.left + target.width / 2 - 20
  const endY = target.top + target.height / 2 - 25
  const middleX = (startX + endX) / 2 - 40
  const middleY = Math.min(startY, endY) - 80
  Object.assign(fabric.style, {
    position: 'fixed', left: `${startX}px`, top: `${startY}px`, width: '40px', height: '50px',
    zIndex: '9999', pointerEvents: 'none', transformOrigin: 'center center',
  })
  document.body.appendChild(fabric)

  try {
    const animation = fabric.animate([
      { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
      { transform: `translate(${middleX - startX}px,${middleY - startY}px) scale(0.9) rotate(-15deg)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${endX - startX}px,${endY - startY}px) scale(0.2) rotate(10deg)`, opacity: 0 },
    ], { duration: 700, easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)', fill: 'forwards' })
    animation.onfinish = () => {
      fabric.remove()
      cartIcon.classList.add('cart-bounce')
      window.setTimeout(() => cartIcon.classList.remove('cart-bounce'), 400)
      onComplete()
    }
  } catch {
    fabric.remove()
    onComplete()
  }
}

function initialVariantSelection(item, variants) {
  const availableColors = unique(variants.map((entry) => entry.color))
  const firstAvailableVariant = variants.find((entry) => Number(entry.stockQty) > 0)
  const initialColor = firstAvailableVariant?.color || availableColors[0] || item.color?.[0] || ''
  const initialSize = firstAvailableVariant?.size
    || unique(variants.filter((entry) => entry.color === initialColor).map((entry) => entry.size))[0]
    || item.size?.[0] || ''
  return { color: initialColor, size: initialSize }
}

async function loadProductData(id) {
  const query = '?lang=EN'
  const [detailResult, variantResult, imageResult] = await Promise.allSettled([
    apiClient.get(`/client/products/${encodeURIComponent(id)}${query}`, { redirectOn401: false }),
    apiClient.get(`/client/products/${encodeURIComponent(id)}/variants${query}`, { redirectOn401: false }),
    apiClient.get(`/client/products/${encodeURIComponent(id)}/images`, { redirectOn401: false }),
  ])
  if (detailResult.status !== 'fulfilled' || !detailResult.value?.data) {
    throw new Error('Product details unavailable')
  }

  const item = detailResult.value.data
  const variants = variantResult.status === 'fulfilled' && Array.isArray(variantResult.value?.data)
    ? variantResult.value.data : []
  const media = imageResult.status === 'fulfilled' && Array.isArray(imageResult.value?.data)
    ? imageResult.value.data : []
  const imageUrls = unique(media.map((entry) => entry.publicUrl).filter(Boolean))
  const images = imageUrls.length ? imageUrls : [item.image].filter(Boolean)
  const selection = initialVariantSelection(item, variants)
  const params = new URLSearchParams({ lang: 'EN', limit: '4', excludeProductIds: String(item.productId) })
  if (item.category?.slug) params.set('category', item.category.slug)

  let recommendations = []
  try {
    const result = await apiClient.get(`/client/products/recommendations?${params}`, { redirectOn401: false })
    const products = result?.data?.products
    if (Array.isArray(products)) {
      recommendations = products
        .filter((entry) => Number(entry.productId) !== Number(item.productId))
        .slice(0, 4)
    }
  } catch {
    recommendations = []
  }

  return { item, variants, images, ...selection, recommendations }
}

function Accordion({ title, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-t border-[#e0dbd2] last:border-b">
      <button aria-expanded={open} className="flex w-full items-center justify-between py-3 text-left text-[0.78rem] leading-[1.5] tracking-[0.03em] text-[#2a2520]" onClick={() => setOpen((value) => !value)} type="button">
        {title}<svg aria-hidden="true" className={`h-[13px] w-[13px] shrink-0 transition-transform ${open ? 'rotate-45' : ''}`} fill="none" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" stroke="currentColor" strokeWidth="2" /></svg>
      </button>
      {open && <div className="pb-3 text-[0.78rem] leading-[1.75] text-[#999]">{children}</div>}
    </div>
  )
}

function VariantSelectors({ colors, variants, color, sizes, size, selectColor, selectSize }) {
  const hasVariantCatalog = variants.length > 0
  return (
    <>
      <p className="mb-[7px] text-[0.62rem] uppercase tracking-[0.12em] text-[#999]">COLOR: <strong className="text-[#2a2520]">{color}</strong></p>
      <div aria-label="Available colors" className="mb-4 flex gap-[7px]">
        {colors.map((entry) => {
          const colorHasStock = !hasVariantCatalog || variants.some((variant) => variant.color === entry && Number(variant.stockQty) > 0)
          return <button aria-label={`${entry}${colorHasStock ? '' : ', out of stock'}`} aria-pressed={entry === color} className={`h-6 w-6 rounded-full border-2 transition-transform ${entry === color ? 'scale-110 border-[#b89b6e]' : 'border-transparent hover:scale-110'} disabled:cursor-not-allowed disabled:opacity-40`} disabled={!colorHasStock} key={entry} onClick={() => selectColor(entry)} style={{ backgroundColor: getColorSwatch(entry), boxShadow: isLightColor(entry) ? 'inset 0 0 0 1px #bbb' : undefined }} title={colorHasStock ? entry : `${entry} — Out of Stock`} type="button" />
        })}
      </div>

      <p className="mb-[7px] flex items-center justify-between text-[0.62rem] uppercase tracking-[0.12em] text-[#999]"> <span>SIZE: <strong className="text-[#2a2520]">{size}</strong></span><span className="cursor-pointer text-[0.65rem] normal-case tracking-normal underline">Size guide</span></p>
      <div aria-label="Available sizes" className="mb-[5px] flex flex-wrap gap-[5px]">
        {sizes.map((entry) => {
          const inStock = !hasVariantCatalog || variants.some((variant) => variant.color === color && variant.size === entry && Number(variant.stockQty) > 0)
          return <button aria-label={`${entry}${inStock ? '' : ', out of stock'}`} aria-pressed={entry === size} className={`h-8 min-w-[38px] rounded-full border px-2 text-[0.68rem] transition-colors ${entry === size ? 'border-[#b89b6e] bg-[#b89b6e] text-white' : 'border-[#e0dbd2] bg-white hover:border-[#b89b6e]'} disabled:cursor-not-allowed disabled:opacity-40`} disabled={!inStock} key={entry} onClick={() => selectSize(entry)} title={inStock ? entry : `${entry} — Out of Stock`} type="button">{entry}</button>
        })}
      </div>
    </>
  )
}

function CartToast({ message, onDismiss }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    let firstFrame = 0
    let secondFrame = 0
    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => setVisible(true))
    })
    const hideTimer = window.setTimeout(() => setVisible(false), 2500)
    const dismissTimer = window.setTimeout(() => onDismiss(null), 2850)
    return () => {
      window.cancelAnimationFrame(firstFrame)
      window.cancelAnimationFrame(secondFrame)
      window.clearTimeout(hideTimer)
      window.clearTimeout(dismissTimer)
    }
  }, [message, onDismiss])

  return createPortal(
    <output
      aria-live="polite"
      className="pointer-events-none fixed z-[9998] max-w-[calc(100vw-2rem)] rounded-full bg-[#2a2520] px-[22px] py-2.5 text-center text-[0.78rem] tracking-[0.06em] text-white"
      style={{
        bottom: '28px',
        left: '50%',
        opacity: visible ? 1 : 0,
        transform: `translateX(-50%) translateY(${visible ? '0' : '20px'})`,
        transition: 'opacity .3s, transform .3s',
      }}
    >
      {message}
    </output>,
    document.body,
  )
}

export default function ProductDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState(null)
  const [variants, setVariants] = useState([])
  const [images, setImages] = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [loadedId, setLoadedId] = useState(null)
  const [error, setError] = useState('')
  const [errorId, setErrorId] = useState(null)
  const [selectedImage, setSelectedImage] = useState('')
  const [color, setColor] = useState('')
  const [size, setSize] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [favorite, setFavorite] = useState(false)
  const [cartMessage, setCartMessage] = useState('')
  const [toast, setToast] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    async function loadProduct() {
      const data = await loadProductData(id)
      if (!active) return
      setProduct(data.item)
      setVariants(data.variants)
      setImages(data.images)
      setSelectedImage(data.images[0] || '')
      setColor(data.color)
      setSize(data.size)
      setRecommendations(data.recommendations)
      setError('')
      setErrorId(null)
      setLoadedId(id)
    }
    async function loadFavorite() {
      const payload = await apiClient.get('/client/favorites?lang=EN', { redirectOn401: false })
      if (active) setFavorite((payload?.data?.products || []).some((item) => Number(item.productId) === Number(id)))
    }
    function showProductLoadError() {
      if (active) {
        setErrorId(id)
        setError('This product could not be loaded. Please try again later.')
        setLoadedId(id)
      }
    }
    function clearFavorite() {
      if (active) setFavorite(false)
    }
    loadProduct().catch(showProductLoadError)
    loadFavorite().catch(clearFavorite)
    return () => { active = false }
  }, [id])

  const colors = useMemo(() => unique(variants.map((variant) => variant.color).length
    ? variants.map((variant) => variant.color) : (product?.color || [])), [product, variants])
  const sizes = useMemo(() => {
    const matching = variants.filter((variant) => variant.color === color)
    return unique(matching.length ? matching.map((variant) => variant.size) : (product?.size || []))
  }, [color, product, variants])
  const chosenVariant = variants.find((variant) => variant.color === color && variant.size === size)
  const variantStock = Number(chosenVariant?.stockQty)
  const hasVariantCatalog = variants.length > 0
  const canAddToCart = Boolean(product?.inStock && (!hasVariantCatalog || (chosenVariant && variantStock > 0)))
  const displayedPrice = chosenVariant?.price ?? product?.price
  let displayedOriginalPrice = product?.originalPrice
  if (chosenVariant) {
    displayedOriginalPrice = Number(chosenVariant.compareAtPrice) > Number(chosenVariant.price)
      ? chosenVariant.compareAtPrice
      : null
  }
  const quantityLimit = chosenVariant ? Math.min(10, Math.max(1, variantStock || 1)) : 10

  function selectColor(nextColor) {
    setColor(nextColor)
    const nextVariants = variants.filter((variant) => variant.color === nextColor)
    const nextSizes = unique(nextVariants.map((variant) => variant.size))
    setSize(nextVariants.find((variant) => Number(variant.stockQty) > 0)?.size || nextSizes[0] || '')
    setQuantity(1)
  }

  function selectSize(nextSize) {
    setSize(nextSize)
    setQuantity(1)
  }

  async function toggleFavorite() {
    if (!product || busy) return
    setBusy(true)
    try {
      const response = favorite
        ? await apiClient.delete(`/client/favorites/${product.productId}?lang=EN`, { redirectOn401: false })
        : await apiClient.post(`/client/favorites/${product.productId}?lang=EN`, {}, { redirectOn401: false })
      const nextFavorite = Boolean(response?.data?.isFavorite)
      setFavorite(nextFavorite)
      window.dispatchEvent(new CustomEvent('storefront:favorites-updated', { detail: { count: response?.data?.favoritesCount } }))
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) void navigate('/login')
      else setCartMessage('Could not update favorites. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function addToCart() {
    if (!product || !canAddToCart || busy) return
    setBusy(true)
    setCartMessage('')
    try {
      const result = await apiClient.post('/client/cart/items?lang=EN', {
        productId: product.productId,
        color,
        size,
        quantityCartItem: quantity,
      }, { redirectOn401: false })
      const totalItems = Number(result?.data?.cartSummary?.totalItems || 0)
      window.dispatchEvent(new CustomEvent('storefront:cart-updated', { detail: { count: totalItems } }))
      flyToCart(document.getElementById('pdMainImg'), () => {
        setToast((current) => ({ id: (current?.id || 0) + 1, message: `${product.name} added to cart` }))
      })
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) void navigate('/login')
      else setToast((current) => ({ id: (current?.id || 0) + 1, message: requestError instanceof ApiError ? requestError.message : 'Could not connect to server.' }))
    } finally {
      setBusy(false)
    }
  }

  function handleAddToCart() {
    addToCart().catch(() => setToast((current) => ({ id: (current?.id || 0) + 1, message: 'Could not connect to server.' })))
  }

  function handleToggleFavorite() {
    toggleFavorite().catch(() => setCartMessage('Could not update favorites. Please try again.'))
  }

  const pageState = getPageState(id, loadedId, error, errorId, product)
  if (pageState === 'loading') return <output className="block min-h-[55vh] bg-[#f5f0e8] px-5 py-12 text-sm text-[#777]">Loading product…</output>
  if (pageState === 'error') return <main className="min-h-[55vh] bg-[#f5f0e8] px-5 py-12"><p className="mx-auto max-w-6xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{getPageErrorMessage(id, error, errorId)}</p><Link className="mx-auto mt-5 block max-w-6xl text-sm underline" to="/products">Back to products</Link></main>

  const category = product.category
  const imageList = images.length ? images : [product.image]
  const addToCartLabel = getCartButtonLabel(canAddToCart, busy)
  const favoriteLabel = favorite ? 'Remove from favorites' : 'Add to favorites'
  return (
    <main className="bg-[#f5f0e8] text-[#2a2520]">
      <div className="w-full px-3 md:px-4 lg:px-12">
        <nav aria-label="Breadcrumb" className="overflow-hidden pb-2 pt-3 text-[0.65rem] uppercase tracking-[0.08em] text-[#999]">
          <Link className="hover:text-[#2a2520]" to="/">Home</Link><span className="mx-1.5">/</span>
          {category?.slug ? <><Link className="hover:text-[#2a2520]" to={`/${category.slug}`}>{category.name || category.slug}</Link><span className="mx-1.5">/</span></> : null}
          <span>{product.name}</span>
        </nav>
        <div className="grid mb-2 md:grid-cols-2">
          <section aria-label="Product images" className="mb-3 flex h-[520px] gap-2.5 max-[991px]:h-[400px] max-[767px]:h-[320px] max-[575px]:h-[260px] md:mb-0">
            <div className="flex w-14 shrink-0 flex-col gap-1.5 overflow-y-auto max-[767px]:w-11 max-[575px]:w-9">
              {imageList.map((image, index) => <button aria-label={`Show image ${index + 1}`} aria-pressed={selectedImage === image} className={`h-[68px] w-14 shrink-0 border-2 bg-[#edeae3] p-1 transition-opacity max-[767px]:h-[54px] max-[767px]:w-11 max-[575px]:h-[44px] max-[575px]:w-9 ${selectedImage === image ? 'border-[#b89b6e] opacity-100' : 'border-transparent opacity-60 hover:opacity-90'}`} key={`${image}-${index}`} onClick={() => setSelectedImage(image)} type="button"><img alt="" className="h-full w-full object-contain" loading="lazy" src={image} /></button>)}
            </div>
            <div className="flex min-w-0 flex-1 items-center justify-center overflow-hidden bg-[#edeae3] p-[clamp(12px,2vw,24px)]"><img alt={product.name} className="h-full w-full object-contain transition-opacity" id="pdMainImg" src={selectedImage || product.image} /></div>
          </section>

          <section className="min-[992px]:translate-x-3 min-[992px]:pl-6 min-[992px]:pr-1 max-[991px]:mt-5">
            <h1 className="mb-1.5 font-display text-[1.75rem] font-normal leading-[1.2] text-[#2a2520] max-[991px]:text-[1.4rem] max-[767px]:text-[1.25rem]">{product.name}</h1>
            <p className="mb-3 text-[1.1rem] font-medium text-[#b89b6e]">{money(displayedPrice)}{displayedOriginalPrice != null && <span className="ml-2 text-[0.85rem] text-[#999] line-through">{money(displayedOriginalPrice)}</span>}</p>
            <p className="mb-[18px] text-[0.8rem] leading-[1.75] text-[#999]">{product.detail || ''}</p>

            <VariantSelectors colors={colors} variants={variants} color={color} sizes={sizes} size={size} selectColor={selectColor} selectSize={selectSize} />
            {chosenVariant && chosenVariant.stockQty <= 0 && <p className="mb-2 text-xs text-red-700">Out of Stock</p>}
            <div className="mb-5 mt-4 flex items-stretch gap-[7px]">
              <div className="flex h-[42px] overflow-hidden rounded-full border border-[#e0dbd2] bg-white">
                <button aria-label="Decrease quantity" className="w-[34px]" disabled={quantity <= 1} onClick={() => setQuantity((value) => Math.max(1, value - 1))} type="button">−</button>
                <span aria-label="Quantity" className="grid w-[34px] place-items-center border-x border-[#e0dbd2] text-[0.82rem]">{quantity}</span>
                <button aria-label="Increase quantity" className="w-[34px]" disabled={quantity >= quantityLimit} onClick={() => setQuantity((value) => Math.min(quantityLimit, value + 1))} type="button">+</button>
              </div>
              <button className="h-[42px] flex-1 rounded-full bg-[#b89b6e] text-[0.7rem] uppercase tracking-[0.13em] text-white transition-colors hover:bg-[#a0855a] disabled:cursor-not-allowed disabled:bg-[#e0dbd2] disabled:text-[#999]" disabled={!canAddToCart || busy} onClick={handleAddToCart} type="button">{addToCartLabel}</button>
              <button aria-label={favoriteLabel} aria-pressed={favorite} className={`grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full border bg-white ${favorite ? 'border-[#b89b6e] text-[#b89b6e]' : 'border-[#e0dbd2] text-[#999]'}`} disabled={busy} onClick={handleToggleFavorite} type="button"><svg aria-hidden="true" className="h-4 w-4" fill={favorite ? 'currentColor' : 'none'} viewBox="0 0 24 24"><path d="M4.318 6.318a4.5 4.5 0 0 0 0 6.364L12 20.364l7.682-7.682a4.5 4.5 0 0 0-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 0 0-6.364 0Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" /></svg></button>
            </div>
            {cartMessage && <p aria-live="polite" className="mb-3 text-sm text-[#776242]">{cartMessage}</p>}
            {toast && <CartToast key={toast.id} message={toast.message} onDismiss={setToast} />}
            <div className="mt-2 border-t border-[#e0dbd2]"><Accordion title="Details and Care">{product.detail || 'Please refer to the product label for care instructions.'}</Accordion><Accordion title="Delivery and Returns">{deliveryText}</Accordion></div>
          </section>
        </div>
        {recommendations.length > 0 && <section className="my-10 mb-5"><h2 className="mb-4 font-display text-[1.1rem] font-normal text-[#2a2520]">You May Also Like</h2><div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-4">{recommendations.map((item) => <ProductCard compact key={item.productId} product={item} />)}</div></section>}
      </div>
    </main>
  )
}
