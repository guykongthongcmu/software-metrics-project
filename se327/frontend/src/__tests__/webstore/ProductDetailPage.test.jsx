import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { ApiError, apiClient } from '../../lib/apiClient.js'
import ProductDetailPage from '../../pages/webstore/ProductDetailPage.jsx'
import { FavoritesProvider } from '../../pages/webstore/partials/FavoritesContext.jsx'

vi.mock('../../lib/apiClient.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
  }
})

const product = {
  productId: 59,
  name: 'Premium Linen Shirt',
  detail: 'Breathable linen for everyday wear.',
  image: '/images/shirt-main.jpg',
  price: 90,
  originalPrice: 120,
  color: ['Beige', 'Blue'],
  size: ['M', 'L'],
  inStock: true,
  category: { name: 'Men Shirts', slug: 'men' },
}
const variants = [
  { color: 'Beige', size: 'M', price: 90, compareAtPrice: 120, stockQty: 3 },
  { color: 'Beige', size: 'L', price: 95, compareAtPrice: null, stockQty: 0 },
  { color: 'Blue', size: 'M', price: 100, compareAtPrice: 125, stockQty: 2 },
  { color: 'Green', size: 'S', price: 80, stockQty: 0 },
]

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}</output>
}

function renderDetail(id = '59') {
  return render(
    <MemoryRouter initialEntries={[`/products/${id}`]}>
      <FavoritesProvider>
        <LocationProbe />
        <Routes>
          <Route path="/products/:id" element={<ProductDetailPage />} />
          <Route path="/login" element={<p>Login page</p>} />
        </Routes>
      </FavoritesProvider>
    </MemoryRouter>,
  )
}

function setupApi({
  detail = { data: product },
  variantList = { data: variants },
  images = { data: [
    { publicUrl: '/images/shirt-main.jpg' },
    { publicUrl: '/images/shirt-side.jpg' },
    { publicUrl: '/images/shirt-side.jpg' },
  ] },
  recommendations = { data: { products: [
    { productId: 59, name: 'Current product', price: 90, image: '/current.jpg' },
    { productId: 61, name: 'Recommended one', price: 30, image: '/one.jpg', inStock: true },
    { productId: 62, name: 'Recommended two', price: 31, image: '/two.jpg', inStock: true },
    { productId: 63, name: 'Recommended three', price: 32, image: '/three.jpg', inStock: true },
    { productId: 64, name: 'Recommended four', price: 33, image: '/four.jpg', inStock: true },
    { productId: 65, name: 'Recommended five', price: 34, image: '/five.jpg', inStock: true },
  ] } },
  favorites = { data: { products: [{ productId: 59 }] } },
} = {}) {
  apiClient.get.mockImplementation((path) => {
    if (path.includes('/recommendations')) return recommendations instanceof Error ? Promise.reject(recommendations) : Promise.resolve(recommendations)
    if (path.endsWith('/variants?lang=EN')) return variantList instanceof Error ? Promise.reject(variantList) : Promise.resolve(variantList)
    if (path.endsWith('/images')) return images instanceof Error ? Promise.reject(images) : Promise.resolve(images)
    if (path.startsWith('/client/favorites')) return favorites instanceof Error ? Promise.reject(favorites) : Promise.resolve(favorites)
    if (path.startsWith('/client/products/')) return detail instanceof Error ? Promise.reject(detail) : Promise.resolve(detail)
    return Promise.resolve({ data: {} })
  })
  apiClient.post.mockResolvedValue({ data: { cartSummary: { totalItems: 4 }, favoritesCount: 2, isFavorite: true } })
  apiClient.delete.mockResolvedValue({ data: { favoritesCount: 1, isFavorite: false } })
}

describe('ProductDetailPage', () => {
  beforeEach(() => {
    apiClient.get.mockReset()
    apiClient.post.mockReset()
    apiClient.delete.mockReset()
    window.localStorage.clear()
  })

  afterEach(() => cleanup())

  it('loads the gallery, variant price and stock options, favourites, and filtered recommendations', async () => {
    setupApi()
    renderDetail()

    expect(await screen.findByRole('heading', { name: product.name })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Men Shirts' }).getAttribute('href')).toBe('/men')
    expect(screen.getByText('$90.00')).toBeTruthy()
    expect(screen.getByText('$120.00').className).toContain('line-through')
    expect(screen.getByRole('img', { name: product.name }).getAttribute('src')).toBe('/images/shirt-main.jpg')
    expect(screen.getByRole('button', { name: 'Show image 2' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show image 2' }))
    expect(screen.getByRole('img', { name: product.name }).getAttribute('src')).toBe('/images/shirt-side.jpg')
    expect(screen.getByRole('button', { name: 'Remove from favorites' }).getAttribute('aria-pressed')).toBe('true')
    expect(await screen.findByRole('heading', { name: 'Recommended one' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Current product' })).toBeNull()
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(4)
    expect(apiClient.get).toHaveBeenCalledWith('/client/products/59?lang=EN', { redirectOn401: false })
    expect(apiClient.get).toHaveBeenCalledWith('/client/products/59/variants?lang=EN', { redirectOn401: false })
    expect(apiClient.get).toHaveBeenCalledWith('/client/products/59/images', { redirectOn401: false })
    expect(apiClient.get.mock.calls.some(([path]) => path.includes('limit=4') && path.includes('excludeProductIds=59'))).toBe(true)

    const soldOutSize = screen.getByRole('button', { name: 'L, out of stock' })
    expect(soldOutSize.disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Green, out of stock' }).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Blue' }))
    expect(screen.getByText('$100.00')).toBeTruthy()
    expect(screen.getByText('$125.00').className).toContain('line-through')
    fireEvent.click(screen.getByRole('button', { name: 'M' }))
    expect(screen.getByRole('button', { name: 'Add to Cart' }).disabled).toBe(false)
  })

  it('adds the chosen variant and quantity, updates the cart badge, and shows feedback', async () => {
    setupApi({ favorites: { data: { products: [] } } })
    const onCartUpdate = vi.fn()
    window.addEventListener('storefront:cart-updated', onCartUpdate)
    renderDetail()
    await screen.findByRole('heading', { name: product.name })

    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add to Cart' }))
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/client/cart/items?lang=EN', {
      productId: 59, color: 'Beige', size: 'M', quantityCartItem: 2,
    }, { redirectOn401: false }))
    expect(await screen.findByText('Premium Linen Shirt added to cart')).toBeTruthy()
    expect(onCartUpdate.mock.calls[0][0].detail.count).toBe(4)
    const toast = screen.getByText('Premium Linen Shirt added to cart')
    expect(toast.tagName).toBe('OUTPUT')
    expect(toast.parentElement).toBe(document.body)
    expect(toast.style.bottom).toBe('28px')
    expect(toast.style.left).toBe('50%')
    expect(toast.style.transform).toContain('translateX(-50%)')
    window.removeEventListener('storefront:cart-updated', onCartUpdate)
  })

  it('animates the product image into the cart, bounces the cart icon, and shows the toast', async () => {
    setupApi({ favorites: { data: { products: [] } } })
    const cartIcon = document.createElement('a')
    cartIcon.className = 'cart-link'
    cartIcon.getBoundingClientRect = () => ({ left: 400, top: 10, width: 40, height: 40 })
    document.body.appendChild(cartIcon)

    const previousAnimate = Element.prototype.animate
    const animate = vi.fn(() => ({ set onfinish(callback) { callback() } }))
    Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: animate })
    try {
      renderDetail()
      await screen.findByRole('heading', { name: product.name })
      const mainImage = screen.getByRole('img', { name: product.name })
      mainImage.getBoundingClientRect = () => ({ left: 20, top: 30, width: 300, height: 400 })
      fireEvent.click(screen.getByRole('button', { name: 'Add to Cart' }))

      expect(await screen.findByText('Premium Linen Shirt added to cart')).toBeTruthy()
      expect(animate).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ transform: 'translate(0,0) scale(1) rotate(0deg)' }),
      ]), expect.objectContaining({ duration: 700 }))
      expect(cartIcon.classList.contains('cart-bounce')).toBe(true)
      expect(document.querySelector('body > div[aria-hidden="true"]')).toBeNull()
    } finally {
      cartIcon.remove()
      if (previousAnimate) Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: previousAnimate })
      else delete Element.prototype.animate
    }
  })

  it('shows the toast if the browser cannot run the cart animation', async () => {
    setupApi({ favorites: { data: { products: [] } } })
    const cartIcon = document.createElement('a')
    cartIcon.className = 'cart-link'
    document.body.appendChild(cartIcon)
    const previousAnimate = Element.prototype.animate
    Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: () => { throw new Error('Animation unavailable') } })
    try {
      renderDetail()
      await screen.findByRole('heading', { name: product.name })
      fireEvent.click(screen.getByRole('button', { name: 'Add to Cart' }))
      expect(await screen.findByText('Premium Linen Shirt added to cart')).toBeTruthy()
      expect(document.querySelector('body > div[aria-hidden="true"]')).toBeNull()
      expect(cartIcon.classList.contains('cart-bounce')).toBe(false)
    } finally {
      cartIcon.remove()
      if (previousAnimate) Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: previousAnimate })
      else delete Element.prototype.animate
    }
  })

  it('uses a zero badge count when the cart response has no summary', async () => {
    setupApi()
    apiClient.post.mockResolvedValue({ data: {} })
    const onCartUpdate = vi.fn()
    window.addEventListener('storefront:cart-updated', onCartUpdate)
    renderDetail()
    await screen.findByRole('heading', { name: product.name })
    fireEvent.click(screen.getByRole('button', { name: 'Add to Cart' }))
    await screen.findByText('Premium Linen Shirt added to cart')
    expect(onCartUpdate.mock.calls[0][0].detail.count).toBe(0)
    window.removeEventListener('storefront:cart-updated', onCartUpdate)
  })

  it('caps the quantity at the selected variant stock and toggles favourites through the API', async () => {
    setupApi({ favorites: { data: { products: [] } } })
    renderDetail()
    await screen.findByRole('heading', { name: product.name })

    const increase = screen.getByRole('button', { name: 'Increase quantity' })
    fireEvent.click(increase)
    fireEvent.click(increase)
    fireEvent.click(increase)
    expect(screen.getByLabelText('Quantity').textContent).toBe('3')
    expect(increase.disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Decrease quantity' }))
    expect(screen.getByLabelText('Quantity').textContent).toBe('2')

    fireEvent.click(screen.getAllByRole('button', { name: 'Add to favorites' })[0])
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/client/favorites/59?lang=EN', {}, { redirectOn401: false }))
    expect(await screen.findByRole('button', { name: 'Remove from favorites' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Remove from favorites' }))
    await waitFor(() => expect(apiClient.delete).toHaveBeenCalledWith('/client/favorites/59?lang=EN', { redirectOn401: false }))
    expect((await screen.findAllByRole('button', { name: 'Add to favorites' })).length).toBeGreaterThan(0)
  })

  it('redirects to login when adding a cart item without a session', async () => {
    setupApi()
    apiClient.post.mockRejectedValue(new ApiError('Unauthorized', { status: 401 }))
    renderDetail()
    await screen.findByRole('heading', { name: product.name })
    fireEvent.click(screen.getByRole('button', { name: 'Add to Cart' }))
    expect(await screen.findByText('Login page')).toBeTruthy()
  })

  it('redirects to login when changing favourites without a session', async () => {
    setupApi({ favorites: { data: { products: [] } } })
    apiClient.post.mockRejectedValueOnce(new ApiError('Unauthorized', { status: 401 }))
    renderDetail()
    await screen.findByRole('heading', { name: product.name })
    fireEvent.click(screen.getAllByRole('button', { name: 'Add to favorites' })[0])
    expect(await screen.findByText('Login page')).toBeTruthy()
  })

  it('shows feedback when the favourites API fails for a non-auth reason', async () => {
    setupApi({ favorites: { data: { products: [] } } })
    apiClient.post.mockRejectedValueOnce(new ApiError('Favourites unavailable', { status: 503 }))
    renderDetail()
    await screen.findByRole('heading', { name: product.name })
    fireEvent.click(screen.getAllByRole('button', { name: 'Add to favorites' })[0])
    expect(await screen.findByText('Could not update favorites. Please try again.')).toBeTruthy()
  })

  it('shows an error when the detail request fails or returns no product', async () => {
    for (const detail of [new Error('offline'), { data: null }]) {
      setupApi({ detail })
      const view = renderDetail()
      expect(await screen.findByRole('alert')).toBeTruthy()
      view.unmount()
    }
  })

  it('shows loading while requests are pending and ignores the response after unmount', async () => {
    const deferred = () => {
      let resolve
      const promise = new Promise((resolvePromise) => { resolve = resolvePromise })
      return { promise, resolve }
    }
    const detailRequest = deferred()
    const variantsRequest = deferred()
    const imagesRequest = deferred()
    const favoritesRequest = deferred()
    apiClient.get.mockImplementation((path) => {
      if (path.endsWith('/variants?lang=EN')) return variantsRequest.promise
      if (path.endsWith('/images')) return imagesRequest.promise
      if (path.startsWith('/client/favorites')) return favoritesRequest.promise
      return detailRequest.promise
    })
    const view = renderDetail()
    expect(screen.getByText('Loading product…')).toBeTruthy()
    view.unmount()
    detailRequest.resolve({ data: product })
    variantsRequest.resolve({ data: variants })
    imagesRequest.resolve({ data: [] })
    favoritesRequest.resolve({ data: { products: [] } })
    await Promise.allSettled([
      detailRequest.promise, variantsRequest.promise, imagesRequest.promise, favoritesRequest.promise,
    ])
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.queryByRole('heading', { name: product.name })).toBeNull()
  })

  it('ignores rejected requests after unmount', async () => {
    let rejectDetail
    let rejectFavorites
    const detailRequest = new Promise((_resolve, reject) => { rejectDetail = reject })
    const favoritesRequest = new Promise((_resolve, reject) => { rejectFavorites = reject })
    apiClient.get.mockImplementation((path) => {
      if (path.startsWith('/client/favorites')) return favoritesRequest
      return detailRequest
    })
    const view = renderDetail()
    view.unmount()
    rejectDetail(new Error('offline'))
    rejectFavorites(new Error('offline'))
    await Promise.allSettled([detailRequest, favoritesRequest])
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.queryByRole('heading', { name: product.name })).toBeNull()
  })

  it('renders safe fallbacks for missing product image, options, description, and price', async () => {
    setupApi({
      detail: { data: { ...product, image: undefined, detail: '', price: undefined, originalPrice: null, color: ['', null], size: [], category: null } },
      variantList: { data: [] },
      images: { data: [] },
      recommendations: { data: { products: [] } },
      favorites: { data: {} },
    })
    renderDetail()
    expect(await screen.findByRole('heading', { name: product.name })).toBeTruthy()
    expect(screen.getByText('—')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Details and Care' }))
    expect(screen.getByText('Please refer to the product label for care instructions.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Show image 1' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add to Cart' }).disabled).toBe(false)
  })

  it('falls back to product image and base options when variant and image endpoints fail', async () => {
    setupApi({
      detail: { data: { ...product, detail: '', category: null, image: '/fallback.jpg', color: ['Ivory', 'Unknown'], size: ['ONE'], originalPrice: null, inStock: false } },
      variantList: new Error('variants unavailable'),
      images: new Error('images unavailable'),
      recommendations: { data: { products: null } },
      favorites: new Error('signed out'),
    })
    renderDetail()

    expect(await screen.findByRole('heading', { name: product.name })).toBeTruthy()
    expect(screen.getByRole('img', { name: product.name }).getAttribute('src')).toBe('/fallback.jpg')
    expect(screen.getByRole('button', { name: 'Ivory' }).style.boxShadow).toContain('inset')
    expect(screen.getByRole('button', { name: 'Unknown' }).style.backgroundColor).toBe('rgb(204, 204, 204)')
    expect(screen.getByRole('button', { name: 'ONE' }).disabled).toBe(false)
    expect(screen.getByRole('button', { name: 'Out of Stock' }).disabled).toBe(true)
    expect(screen.getByText('$90.00')).toBeTruthy()
    expect(screen.queryByText('$120.00')).toBeNull()
    expect(screen.queryByText('You May Also Like')).toBeNull()
    expect(screen.getByRole('button', { name: 'Add to favorites' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Details and Care' }))
    expect(screen.getByText('Please refer to the product label for care instructions.')).toBeTruthy()
  })

  it('shows unavailable variants as out of stock and handles cart errors', async () => {
    setupApi({
      detail: { data: { ...product, inStock: true } },
      variantList: { data: [{ color: 'Black', size: 'ONE', price: 12, stockQty: 0 }] },
      recommendations: new Error('recommendations unavailable'),
    })
    renderDetail()
    expect(await screen.findByRole('button', { name: 'Out of Stock' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Out of Stock' }).disabled).toBe(true)
    expect(screen.getAllByText('Out of Stock').length).toBeGreaterThan(0)

    setupApi()
    apiClient.post.mockRejectedValue(new ApiError('Cart is unavailable', { status: 500 }))
    cleanup()
    renderDetail()
    await screen.findByRole('heading', { name: product.name })
    fireEvent.click(screen.getByRole('button', { name: 'Add to Cart' }))
    expect(await screen.findByText('Cart is unavailable')).toBeTruthy()
  })

  it('keeps the product visible if the recommendation response is malformed', async () => {
    setupApi()
    apiClient.get.mockImplementation((path) => {
      if (path.includes('/recommendations')) return null
      if (path.endsWith('/variants?lang=EN')) return Promise.resolve({ data: variants })
      if (path.endsWith('/images')) return Promise.resolve({ data: [] })
      if (path.startsWith('/client/favorites')) return Promise.resolve({ data: { products: [] } })
      return Promise.resolve({ data: product })
    })
    renderDetail()
    expect(await screen.findByRole('heading', { name: product.name })).toBeTruthy()
    expect(screen.queryByText('You May Also Like')).toBeNull()
  })

  it('shows a generic cart connection error for non-API failures and supports both accordions', async () => {
    setupApi()
    apiClient.post.mockRejectedValue(new Error('offline'))
    renderDetail()
    await screen.findByRole('heading', { name: product.name })
    fireEvent.click(screen.getByRole('button', { name: 'Add to Cart' }))
    expect(await screen.findByText('Could not connect to server.')).toBeTruthy()
    const details = screen.getByRole('button', { name: /Details and Care/ })
    fireEvent.click(details)
    expect(details.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getAllByText(product.detail).length).toBe(2)
    const delivery = screen.getByRole('button', { name: /Delivery and Returns/ })
    fireEvent.click(delivery)
    expect(delivery.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText(/Free standard delivery/)).toBeTruthy()
  })
})
