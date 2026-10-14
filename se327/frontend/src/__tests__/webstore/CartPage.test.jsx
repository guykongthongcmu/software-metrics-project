import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { ApiError, apiClient } from '../../lib/apiClient.js'
import CartPage from '../../pages/webstore/CartPage.jsx'
import { FavoritesProvider } from '../../pages/webstore/partials/FavoritesContext.jsx'

vi.mock('../../lib/apiClient.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, apiClient: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() } }
})

vi.mock('../../pages/webstore/partials/ProductCard.jsx', () => ({
  default: ({ product }) => <div data-testid="recommendation">{product.name}</div>,
}))

const firstItem = {
  itemId: 8,
  productId: 59,
  name: 'Linen Shirt',
  image: '/shirt.jpg',
  color: 'Lilac',
  size: 'M',
  price: 90,
  originalPrice: 120,
  quantityCartItem: 2,
}
const secondItem = {
  itemId: 9,
  productId: 60,
  name: 'Canvas Tote',
  color: 'Unknown',
  price: 25,
  quantityCartItem: 1,
}
const recommendations = Array.from({ length: 5 }, (_, index) => ({
  productId: index + 70,
  name: `Recommendation ${index + 1}`,
}))

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}</output>
}

function renderCart() {
  return render(
    <MemoryRouter initialEntries={['/cart']}>
      <LocationProbe />
      <Routes>
        <Route path="/cart" element={<FavoritesProvider><CartPage /></FavoritesProvider>} />
        <Route path="/login" element={<p>Login page</p>} />
        <Route path="/checkout" element={<p>Checkout page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

function setupApi({
  cart = { data: { items: [firstItem, secondItem], cartSummary: { subtotal: 205, totalItems: 3 } } },
  recs = { data: { products: recommendations } },
} = {}) {
  apiClient.get.mockImplementation((path) => {
    const value = path.includes('/recommendations') ? recs : cart
    return value instanceof Error ? Promise.reject(value) : Promise.resolve(value)
  })
  apiClient.put.mockResolvedValue({ data: { item: { quantityCartItem: 3 }, cartSummary: { subtotal: 270, totalItems: 4 } } })
  apiClient.post.mockResolvedValue({ data: { isFavorite: true, favoritesCount: 1 } })
  apiClient.delete.mockResolvedValue({ data: { cartSummary: { subtotal: 25, totalItems: 1 } } })
}

describe('CartPage', () => {
  beforeEach(() => {
    apiClient.get.mockReset()
    apiClient.put.mockReset()
    apiClient.post.mockReset()
    apiClient.delete.mockReset()
  })

  afterEach(() => cleanup())

  it('loads cart items, subtotal, recommendations, and updates the cart badge', async () => {
    setupApi()
    const onCartUpdate = vi.fn()
    window.addEventListener('storefront:cart-updated', onCartUpdate)
    renderCart()

    expect(await screen.findByRole('heading', { name: 'Your cart' })).toBeTruthy()
    expect(screen.getByText('3 items in your selection')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'View Linen Shirt' }).getAttribute('href')).toBe('/products/59')
    expect(screen.getByRole('img', { name: 'Linen Shirt' }).getAttribute('src')).toBe('/shirt.jpg')
    expect(screen.getAllByText((_, node) => node?.textContent === 'Color: Lilac | Size: M')).toHaveLength(2)
    expect(screen.getByText('$180.00')).toBeTruthy()
    expect(screen.getByText('$120.00').className).toContain('line-through')
    expect(screen.getByRole('img', { name: 'Canvas Tote' }).getAttribute('src')).toBe('/images/product-placeholder.png')
    expect(screen.getByText('$25.00')).toBeTruthy()
    expect(screen.getByText('$205.00')).toBeTruthy()
    expect(screen.getAllByTestId('recommendation')).toHaveLength(4)
    expect(screen.queryByText('Recommendation 5')).toBeNull()
    expect(onCartUpdate.mock.calls[0][0].detail.count).toBe(3)
    expect(apiClient.get).toHaveBeenCalledWith('/client/cart?lang=EN', { redirectOn401: false })
    expect(apiClient.get).toHaveBeenCalledWith('/client/products/recommendations?limit=4&context=cart&lang=EN', { redirectOn401: false })
    window.removeEventListener('storefront:cart-updated', onCartUpdate)
  })

  it('keeps heart, remove, and price columns aligned across different price widths', async () => {
    const higherPricedItem = {
      ...secondItem,
      itemId: 10,
      productId: 61,
      name: 'Leather Weekender',
      price: 1980,
      originalPrice: 2450,
    }
    setupApi({ cart: { data: { items: [firstItem, higherPricedItem], cartSummary: { subtotal: 2160, totalItems: 3 } } } })
    renderCart()

    await screen.findByRole('link', { name: 'View Leather Weekender' })
    const rows = screen.getAllByRole('article')
    expect(rows).toHaveLength(2)

    rows.forEach((row) => {
      expect(row.children[2].className).toContain('w-[72px]')
      expect(row.children[2].className).toContain('max-[575px]:w-16')
      expect(row.children[3].className).toContain('w-[110px]')
      expect(row.children[3].className).toContain('max-[575px]:w-20')
    })
    expect(screen.getByText('$1980.00')).toBeTruthy()
  })

  it('enables the cart heart after favorites load and updates its state through the API', async () => {
    setupApi()
    renderCart()
    const favoriteButton = await screen.findByRole('button', { name: 'Add Linen Shirt to favorites' })
    fireEvent.click(favoriteButton)

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/client/favorites/59?lang=EN', {}, { redirectOn401: false }))
    expect(await screen.findByRole('button', { name: 'Remove Linen Shirt from favorites' })).toBeTruthy()
  })

  it('uses safe fallbacks for malformed item fields and invalid prices', async () => {
    const malformedItem = { ...secondItem, itemId: 10, color: '', size: '', price: 'invalid', quantityCartItem: 0, originalPrice: 1 }
    setupApi({ cart: { data: { items: [malformedItem], cartSummary: {} } }, recs: { data: { products: {} } } })
    renderCart()

    expect(await screen.findByRole('link', { name: 'View Canvas Tote' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Canvas Tote' }).getAttribute('src')).toBe('/images/product-placeholder.png')
    expect(screen.getByLabelText('Unknown colour')).toBeTruthy()
    expect(screen.getAllByText((_, node) => node?.textContent === 'Color: — | Size: —')).toHaveLength(2)
    expect(screen.getByLabelText('Quantity: 1')).toBeTruthy()
    expect(screen.getAllByText('$0.00')).toHaveLength(2)
    expect(screen.queryByText('You may also like')).toBeNull()
  })

  it('updates item quantity, subtotal, and badge; quantity boundaries are enforced', async () => {
    setupApi()
    const onCartUpdate = vi.fn()
    window.addEventListener('storefront:cart-updated', onCartUpdate)
    renderCart()
    await screen.findByRole('link', { name: 'View Linen Shirt' })

    fireEvent.click(screen.getByRole('button', { name: 'Increase Linen Shirt quantity' }))
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/client/cart/items/8?lang=EN', { quantityCartItem: 3 }, { redirectOn401: false }))
    expect(screen.getByLabelText('Quantity: 3')).toBeTruthy()
    expect(screen.getAllByText('$270.00')).toHaveLength(2)
    expect(onCartUpdate.mock.calls.at(-1)[0].detail.count).toBe(4)

    fireEvent.click(screen.getByRole('button', { name: 'Decrease Linen Shirt quantity' }))
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledTimes(2))
    expect(apiClient.put).toHaveBeenLastCalledWith('/client/cart/items/8?lang=EN', { quantityCartItem: 2 }, { redirectOn401: false })
    expect(screen.getByRole('button', { name: 'Decrease Canvas Tote quantity' }).disabled).toBe(true)
    window.removeEventListener('storefront:cart-updated', onCartUpdate)
  })

  it('disables row actions while a quantity request is pending', async () => {
    setupApi()
    let resolveUpdate
    apiClient.put.mockReturnValue(new Promise((resolve) => { resolveUpdate = resolve }))
    renderCart()
    await screen.findByRole('link', { name: 'View Linen Shirt' })
    fireEvent.click(screen.getByRole('button', { name: 'Increase Linen Shirt quantity' }))

    expect(screen.getByRole('button', { name: 'Increase Linen Shirt quantity' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Decrease Linen Shirt quantity' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Remove Linen Shirt from cart' }).disabled).toBe(true)
    resolveUpdate({ data: { item: { quantityCartItem: 3 }, cartSummary: { subtotal: 270, totalItems: 4 } } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Remove Linen Shirt from cart' }).disabled).toBe(false))
  })

  it('removes an item, refreshes the subtotal, and shows the empty cart state', async () => {
    setupApi()
    const onCartUpdate = vi.fn()
    window.addEventListener('storefront:cart-updated', onCartUpdate)
    renderCart()
    await screen.findByRole('link', { name: 'View Linen Shirt' })
    fireEvent.click(screen.getByRole('button', { name: 'Remove Linen Shirt from cart' }))

    await waitFor(() => expect(apiClient.delete).toHaveBeenCalledWith('/client/cart/items/8?lang=EN', { redirectOn401: false }))
    expect(screen.queryByRole('link', { name: 'View Linen Shirt' })).toBeNull()
    expect(screen.getAllByText('$25.00')).toHaveLength(2)
    expect(onCartUpdate.mock.calls.at(-1)[0].detail.count).toBe(1)

    fireEvent.click(screen.getByRole('button', { name: 'Remove Canvas Tote from cart' }))
    await waitFor(() => expect(screen.getByText(/Your cart is now empty/)).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Check Out' }).disabled).toBe(true)
    window.removeEventListener('storefront:cart-updated', onCartUpdate)
  })

  it('renders the empty state for an empty or malformed cart and handles missing recommendations', async () => {
    setupApi({ cart: { data: { items: null, cartSummary: null } }, recs: new Error('offline') })
    renderCart()
    expect(await screen.findByText(/Your cart is now empty/)).toBeTruthy()
    expect(screen.getByText('0 items in your selection')).toBeTruthy()
    expect(screen.getByText('$0.00')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Check Out' }).disabled).toBe(true)
    expect(screen.queryByText('You may also like')).toBeNull()
  })

  it('shows API and generic errors when loading cart data fails', async () => {
    for (const [failure, expected] of [
      [new ApiError('Cart service unavailable', { status: 503 }), 'Cart service unavailable'],
      [new Error('network down'), 'Could not load your cart. Please try again.'],
    ]) {
      setupApi({ cart: failure })
      const view = renderCart()
      expect((await screen.findByRole('alert')).textContent).toBe(expected)
      view.unmount()
    }
  })

  it('shows update and removal errors without losing cart items', async () => {
    setupApi()
    renderCart()
    await screen.findByRole('link', { name: 'View Linen Shirt' })
    apiClient.put.mockRejectedValueOnce(new ApiError('Quantity update failed', { status: 503 }))
    fireEvent.click(screen.getByRole('button', { name: 'Increase Linen Shirt quantity' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Quantity update failed')

    apiClient.delete.mockRejectedValueOnce(new Error('offline'))
    fireEvent.click(screen.getByRole('button', { name: 'Remove Linen Shirt from cart' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Could not remove this item. Please try again.')
    expect(screen.getByRole('link', { name: 'View Linen Shirt' })).toBeTruthy()
  })

  it('redirects to login when cart endpoints reject an unauthenticated request', async () => {
    setupApi({ cart: new ApiError('Unauthorized', { status: 401 }) })
    renderCart()
    expect(await screen.findByText('Login page')).toBeTruthy()

    cleanup()
    setupApi()
    renderCart()
    await screen.findByRole('link', { name: 'View Linen Shirt' })
    apiClient.put.mockRejectedValueOnce(new ApiError('Unauthorized', { status: 401 }))
    fireEvent.click(screen.getByRole('button', { name: 'Increase Linen Shirt quantity' }))
    expect(await screen.findByText('Login page')).toBeTruthy()

    cleanup()
    setupApi()
    renderCart()
    await screen.findByRole('link', { name: 'View Linen Shirt' })
    apiClient.delete.mockRejectedValueOnce(new ApiError('Unauthorized', { status: 401 }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove Linen Shirt from cart' }))
    expect(await screen.findByText('Login page')).toBeTruthy()
  })

  it('ignores pending cart and recommendation responses after unmount', async () => {
    let resolveCart
    let resolveRecs
    let resolveFavorites
    apiClient.get.mockImplementation((path) => new Promise((resolve) => {
      if (path.includes('/favorites')) resolveFavorites = resolve
      else if (path.includes('/recommendations')) resolveRecs = resolve
      else resolveCart = resolve
    }))
    const view = renderCart()
    view.unmount()
    resolveCart({ data: { items: [firstItem], cartSummary: { subtotal: 90, totalItems: 1 } } })
    resolveRecs({ data: { products: recommendations } })
    resolveFavorites({ data: { products: [] } })
    await Promise.all(apiClient.get.mock.results.map(({ value }) => value))
    expect(screen.queryByRole('heading', { name: 'Your cart' })).toBeNull()
  })

  it('navigates to checkout from the cart', async () => {
    setupApi()
    renderCart()
    await screen.findByRole('link', { name: 'View Linen Shirt' })
    fireEvent.click(screen.getByRole('button', { name: 'Check Out' }))
    expect(await screen.findByText('Checkout page')).toBeTruthy()
  })
})
