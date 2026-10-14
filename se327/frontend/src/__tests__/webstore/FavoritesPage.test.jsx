import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { ApiError, apiClient } from '../../lib/apiClient.js'
import FavoritesPage from '../../pages/webstore/FavoritesPage.jsx'

vi.mock('../../lib/apiClient.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }
})

const savedProduct = {
  productId: 21,
  name: 'Lilac Shirt',
  image: '/lilac-shirt.jpg',
  price: 45,
  size: ['S', 'M'],
  color: ['Lilac', 'Mocha'],
}
const savedProductTwo = { ...savedProduct, productId: 22, name: 'Mocha Jacket', price: 'invalid', size: [], color: [] }
const suggestions = Array.from({ length: 5 }, (_, index) => ({
  productId: index + 31,
  name: `Suggestion ${index + 1}`,
  image: index === 0 ? '' : `/suggestion-${index + 1}.jpg`,
  price: 60 + index,
  color: index === 0 ? undefined : ['Lilac', 'White'],
}))

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}</output>
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/favorites']}>
      <LocationProbe />
      <Routes>
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/login" element={<p>Login page</p>} />
        <Route path="/" element={<p>Storefront home</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

function setupApi({ favorites, recommendations } = {}) {
  const favoriteResponse = favorites ?? { data: { products: [savedProduct, savedProductTwo], favoritesCount: 2 } }
  const recommendationResponse = recommendations ?? { data: { products: suggestions } }
  apiClient.get.mockImplementation((path) => {
    if (path.startsWith('/client/favorites')) return favoriteResponse instanceof Error ? Promise.reject(favoriteResponse) : Promise.resolve(favoriteResponse)
    return recommendationResponse instanceof Error ? Promise.reject(recommendationResponse) : Promise.resolve(recommendationResponse)
  })
  apiClient.post.mockImplementation((path) => {
    if (path.startsWith('/client/cart')) return Promise.resolve({ data: { cartSummary: { totalItems: 3 } } })
    return Promise.resolve({ data: { isFavorite: true, favoritesCount: 3, product: suggestions[0] } })
  })
  apiClient.delete.mockResolvedValue({ data: { favoritesCount: 1 } })
}

describe('FavoritesPage', () => {
  beforeEach(() => {
    apiClient.get.mockReset()
    apiClient.post.mockReset()
    apiClient.delete.mockReset()
  })

  afterEach(() => cleanup())

  it('loads saved products and four recommendations while updating the favorites count', async () => {
    setupApi()
    const favoriteListener = vi.fn()
    window.addEventListener('storefront:favorites-updated', favoriteListener)
    renderPage()

    expect(await screen.findByRole('link', { name: 'View Lilac Shirt' })).toBeTruthy()
    expect(screen.getByText('Mocha Jacket')).toBeTruthy()
    expect(screen.getByText('$45.00')).toBeTruthy()
    expect(screen.getByText('—')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Lilac Shirt' }).getAttribute('src')).toBe('/lilac-shirt.jpg')
    expect(screen.getAllByRole('article')).toHaveLength(6)
    expect(screen.queryByText('Suggestion 5')).toBeNull()
    expect(apiClient.get).toHaveBeenCalledWith('/client/favorites?lang=EN', { redirectOn401: false })
    expect(apiClient.get).toHaveBeenCalledWith('/client/products/recommendations?limit=4&context=favorites&excludeProductIds=21%2C22&lang=EN', { redirectOn401: false })
    expect(favoriteListener.mock.calls[0][0].detail.count).toBe(2)
    window.removeEventListener('storefront:favorites-updated', favoriteListener)
  })

  it('removes saved items immediately and shows the empty state when the last is removed', async () => {
    setupApi()
    const listener = vi.fn()
    window.addEventListener('storefront:favorites-updated', listener)
    renderPage()
    await screen.findByRole('link', { name: 'View Lilac Shirt' })

    apiClient.delete.mockResolvedValueOnce({ data: { favoritesCount: 0 } })
    fireEvent.click(screen.getByRole('button', { name: 'Remove Lilac Shirt from favorites' }))
    await waitFor(() => expect(apiClient.delete).toHaveBeenCalledWith('/client/favorites/21?lang=EN', { redirectOn401: false }))
    expect(screen.queryByRole('link', { name: 'View Lilac Shirt' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Remove Mocha Jacket from favorites' }))
    expect(await screen.findByText('SAVE YOUR FAVOURITE ITEMS NOW !')).toBeTruthy()
    expect(listener.mock.calls[1][0].detail).toMatchObject({ count: 0, productId: 21, isFavorite: false })
    expect(apiClient.get).toHaveBeenCalledTimes(2)
    window.removeEventListener('storefront:favorites-updated', listener)
  })

  it('requires size and color before adding, then submits selections and reports success', async () => {
    setupApi({ favorites: { data: { products: [savedProduct], favoritesCount: 1 } } })
    const cartListener = vi.fn()
    window.addEventListener('storefront:cart-updated', cartListener)
    renderPage()
    await screen.findByRole('link', { name: 'View Lilac Shirt' })

    const addButton = screen.getByRole('button', { name: 'ADD TO CART' })
    fireEvent.click(addButton)
    expect(screen.getByRole('alert').textContent).toBe('Please select a size and color.')
    fireEvent.change(screen.getByLabelText('Select colour for Lilac Shirt'), { target: { value: 'Mocha' } })
    fireEvent.click(addButton)
    expect(screen.getByRole('alert').textContent).toBe('Please select a size and color.')
    fireEvent.change(screen.getByLabelText('Select size for Lilac Shirt'), { target: { value: 'M' } })
    fireEvent.click(addButton)

    expect(await screen.findByText('Lilac Shirt added to cart')).toBeTruthy()
    expect(apiClient.post).toHaveBeenCalledWith('/client/cart/items?lang=EN', {
      productId: 21, color: 'Mocha', size: 'M', quantityCartItem: 1,
    }, { redirectOn401: false })
    expect(cartListener.mock.calls[0][0].detail.count).toBe(3)
    window.removeEventListener('storefront:cart-updated', cartListener)
  })

  it('disables add to cart when either variant list is unavailable', async () => {
    const missingSizes = { ...savedProduct, productId: 23, name: 'No sizes', size: [], color: ['White'] }
    const missingColors = { ...savedProduct, productId: 24, name: 'No colors', size: ['L'], color: [] }
    const malformedVariants = { ...savedProduct, productId: 25, name: 'Malformed variants', size: 'M', color: 'Blue' }
    setupApi({ favorites: { data: { products: [savedProductTwo, missingSizes, missingColors, malformedVariants] } } })
    renderPage()
    await screen.findByRole('link', { name: 'View Mocha Jacket' })
    expect(screen.getAllByRole('button', { name: 'ADD TO CART' }).every((button) => button.disabled)).toBe(true)
    expect(screen.getByLabelText('Select size for Mocha Jacket').children).toHaveLength(1)
    expect(screen.getByLabelText('Select colour for Mocha Jacket').children).toHaveLength(1)
    expect(screen.getByRole('img', { name: 'No sizes' }).getAttribute('src')).toBe('/lilac-shirt.jpg')
    expect(screen.getByRole('img', { name: 'Malformed variants' }).getAttribute('src')).toBe('/lilac-shirt.jpg')
  })

  it('toggles a recommended product into the saved list and toggles it back off', async () => {
    setupApi({ favorites: { data: { products: [] } } })
    renderPage()
    const addFavorite = await screen.findByRole('button', { name: 'Add Suggestion 1 to favorites' })
    fireEvent.click(addFavorite)
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/client/favorites/31?lang=EN', {}, { redirectOn401: false }))
    expect(await screen.findAllByRole('link', { name: 'View Suggestion 1' })).toHaveLength(2)
    const recommendationsSection = screen.getByRole('region', { name: 'Recommendations' })
    fireEvent.click(within(recommendationsSection).getByRole('button', { name: 'Remove Suggestion 1 from favorites' }))
    await waitFor(() => expect(apiClient.delete).toHaveBeenCalledWith('/client/favorites/31?lang=EN', { redirectOn401: false }))
    expect(within(recommendationsSection).getByRole('button', { name: 'Add Suggestion 1 to favorites' }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.queryByRole('region', { name: 'Saved favorites' })).toBeNull()
  })

  it('does not add a recommended product when the API reports it is still not a favorite', async () => {
    setupApi({ favorites: { data: { products: [] } } })
    apiClient.post.mockResolvedValueOnce({ data: { isFavorite: false, favoritesCount: 0 } })
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Add Suggestion 1 to favorites' }))

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/client/favorites/31?lang=EN', {}, { redirectOn401: false }))
    expect(screen.queryByRole('region', { name: 'Saved favorites' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Add Suggestion 1 to favorites' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('handles successful favorite responses without a data payload', async () => {
    setupApi({ favorites: { data: { products: [] } } })
    apiClient.post.mockResolvedValueOnce({})
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Add Suggestion 1 to favorites' }))

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/client/favorites/31?lang=EN', {}, { redirectOn401: false }))
    expect(screen.queryByRole('region', { name: 'Saved favorites' })).toBeNull()
  })

  it('shows empty favorites with recommendations when there are no saved items', async () => {
    setupApi({ favorites: { data: { products: [], favoritesCount: 0 } } })
    renderPage()
    expect(await screen.findByText('SAVE YOUR FAVOURITE ITEMS NOW !')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'START SHOPPING FROM MORE' }).getAttribute('href')).toBe('/')
    expect(screen.getByRole('heading', { name: 'RECOMMENDATION' })).toBeTruthy()
    expect(screen.getAllByRole('article')).toHaveLength(4)
  })

  it('shows a favorites load error and tolerates recommendation failures or malformed payloads', async () => {
    setupApi({ favorites: new ApiError('Favorites unavailable', { status: 503 }) })
    renderPage()
    expect((await screen.findByRole('alert')).textContent).toBe('Favorites unavailable')
    expect(screen.queryByRole('heading', { name: 'RECOMMENDATION' })).toBeNull()

    cleanup()
    setupApi({ favorites: { data: { products: 'invalid' } }, recommendations: new Error('offline') })
    renderPage()
    expect(await screen.findByText('SAVE YOUR FAVOURITE ITEMS NOW !')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'RECOMMENDATION' })).toBeNull()

    cleanup()
    setupApi({ favorites: { data: { products: [] } }, recommendations: { data: { products: 'invalid' } } })
    renderPage()
    expect(await screen.findByText('SAVE YOUR FAVOURITE ITEMS NOW !')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'RECOMMENDATION' })).toBeNull()
  })

  it('redirects to login for unauthorized loads and reports generic failures', async () => {
    setupApi({ favorites: new ApiError('Unauthorized', { status: 401 }) })
    renderPage()
    expect(await screen.findByText('Login page')).toBeTruthy()

    cleanup()
    setupApi({ favorites: new Error('offline') })
    renderPage()
    expect((await screen.findByRole('alert')).textContent).toBe('Could not load your favorites. Please try again.')
  })

  it('shows removal, favorite toggle, and add-to-cart errors without discarding the page', async () => {
    setupApi({ favorites: { data: { products: [savedProduct], favoritesCount: 1 } } })
    renderPage()
    await screen.findByRole('link', { name: 'View Lilac Shirt' })
    apiClient.delete.mockRejectedValueOnce(new Error('offline'))
    fireEvent.click(screen.getByRole('button', { name: 'Remove Lilac Shirt from favorites' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Could not remove this favorite. Please try again.')

    apiClient.post.mockRejectedValueOnce(new ApiError('Favorite update rejected', { status: 503 }))
    fireEvent.click(screen.getByRole('button', { name: 'Add Suggestion 1 to favorites' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Favorite update rejected')

    fireEvent.change(screen.getByLabelText('Select size for Lilac Shirt'), { target: { value: 'S' } })
    fireEvent.change(screen.getByLabelText('Select colour for Lilac Shirt'), { target: { value: 'Lilac' } })
    apiClient.post.mockRejectedValueOnce(new Error('offline'))
    fireEvent.click(screen.getByRole('button', { name: 'ADD TO CART' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Could not add to cart. Please try again.')
    expect(screen.getByRole('link', { name: 'View Lilac Shirt' })).toBeTruthy()
  })

  it('redirects to login when remove, favorite toggle, or add-to-cart calls are unauthorized', async () => {
    setupApi({ favorites: { data: { products: [savedProduct], favoritesCount: 1 } } })
    renderPage()
    await screen.findByRole('link', { name: 'View Lilac Shirt' })
    apiClient.delete.mockRejectedValueOnce(new ApiError('Unauthorized', { status: 401 }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove Lilac Shirt from favorites' })[0])
    expect(await screen.findByText('Login page')).toBeTruthy()

    cleanup()
    setupApi({ favorites: { data: { products: [savedProduct], favoritesCount: 1 } } })
    renderPage()
    await screen.findByRole('link', { name: 'View Lilac Shirt' })
    apiClient.post.mockRejectedValueOnce(new ApiError('Unauthorized', { status: 401 }))
    fireEvent.click(screen.getByRole('button', { name: 'Add Suggestion 1 to favorites' }))
    expect(await screen.findByText('Login page')).toBeTruthy()

    cleanup()
    setupApi({ favorites: { data: { products: [savedProduct], favoritesCount: 1 } } })
    renderPage()
    await screen.findByRole('link', { name: 'View Lilac Shirt' })
    fireEvent.change(screen.getByLabelText('Select size for Lilac Shirt'), { target: { value: 'M' } })
    fireEvent.change(screen.getByLabelText('Select colour for Lilac Shirt'), { target: { value: 'Lilac' } })
    apiClient.post.mockRejectedValueOnce(new ApiError('Unauthorized', { status: 401 }))
    fireEvent.click(screen.getByRole('button', { name: 'ADD TO CART' }))
    expect(await screen.findByText('Login page')).toBeTruthy()
  })

  it('ignores pending page and recommendation responses after unmount', async () => {
    let rejectFavorites
    apiClient.get.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectFavorites = reject }))
    const firstRender = renderPage()
    firstRender.unmount()
    rejectFavorites(new Error('late failure'))
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(1))

    let rejectRecommendations
    setupApi()
    apiClient.get.mockClear()
    apiClient.get.mockImplementation((path) => path.includes('/recommendations')
      ? new Promise((_resolve, reject) => { rejectRecommendations = reject })
      : Promise.resolve({ data: { products: [savedProduct], favoritesCount: 1 } }))
    const secondRender = renderPage()
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2))
    secondRender.unmount()
    rejectRecommendations(new Error('late recommendation failure'))
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2))
    expect(apiClient.get).toHaveBeenCalledTimes(2)
  })

  it('disables add to cart while pending and treats a missing cart count as zero', async () => {
    setupApi({ favorites: { data: { products: [savedProduct] } } })
    let finishAdd
    apiClient.post.mockReturnValueOnce(new Promise((resolve) => { finishAdd = resolve }))
    const cartListener = vi.fn()
    window.addEventListener('storefront:cart-updated', cartListener)
    renderPage()
    await screen.findByRole('link', { name: 'View Lilac Shirt' })
    fireEvent.change(screen.getByLabelText('Select size for Lilac Shirt'), { target: { value: 'M' } })
    fireEvent.change(screen.getByLabelText('Select colour for Lilac Shirt'), { target: { value: 'Lilac' } })
    const addButton = screen.getByRole('button', { name: 'ADD TO CART' })
    fireEvent.click(addButton)
    expect(addButton.disabled).toBe(true)
    finishAdd({})

    await screen.findByText('Lilac Shirt added to cart')
    expect(cartListener.mock.calls[0][0].detail.count).toBe(0)
    expect(addButton.disabled).toBe(false)
    window.removeEventListener('storefront:cart-updated', cartListener)
  })
})
