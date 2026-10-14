import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'
import AllProductsPage from '../../pages/webstore/AllProductsPage.jsx'
import { FavoritesProvider } from '../../pages/webstore/partials/FavoritesContext.jsx'

vi.mock('../../lib/apiClient.js', () => ({ apiClient: { get: vi.fn() } }))

function product(productId, extra = {}) {
  return {
    productId,
    name: `Product ${productId}`,
    image: `/product-${productId}.jpg`,
    price: 25,
    color: ['Lilac', 'Mocha'],
    inStock: true,
    ...extra,
  }
}

function payload(products, totalPages = 1) {
  return { data: { products, pagination: { totalPages } } }
}

function LocationOutput() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}{location.search}</output>
}

function renderPage({ entry = '/products', scrollTo = vi.fn() } = {}) {
  vi.stubGlobal('scrollTo', scrollTo)
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <FavoritesProvider>
        <AllProductsPage />
        <LocationOutput />
      </FavoritesProvider>
    </MemoryRouter>,
  )
}

function setupCatalog(products, categories = []) {
  apiClient.get.mockImplementation((path) => {
    if (path.startsWith('/client/products?')) return Promise.resolve(payload(products))
    if (path.startsWith('/client/categories?')) return Promise.resolve({ data: { categories } })
    return Promise.resolve(payload([]))
  })
}

describe('AllProductsPage', () => {
  beforeEach(() => {
    apiClient.get.mockReset()
    window.localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('loads the catalogue, displays sale data, and defaults to recommended product order', async () => {
    setupCatalog([
      product(9),
      product(2, { originalPrice: 30, discount: { type: 'percentage', value: 17 } }),
    ])
    renderPage()

    expect(screen.getByText('Loading products…').tagName).toBe('OUTPUT')
    expect(await screen.findByRole('heading', { name: 'Product 2' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Product 9' })).toBeTruthy()
    expect(screen.getByText('SALE')).toBeTruthy()
    expect(screen.getByText('$30').className).toContain('line-through')
    expect(screen.getAllByText('$25')).toHaveLength(2)
    expect(screen.getByText('2 items')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Recommended' }).getAttribute('aria-pressed')).toBe('true')
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/products?page=1&sort=recommended'))
    expect(apiClient.get).toHaveBeenCalledWith('/client/products?page=1&limit=50&lang=EN', { redirectOn401: false })
  })

  it('switches to newest order, resets paging, and updates the query string', async () => {
    setupCatalog([product(3), product(8)])
    renderPage({ entry: '/products?page=4&sort=recommended&campaign=spring' })

    await screen.findByRole('heading', { name: 'Product 3' })
    fireEvent.click(screen.getByRole('button', { name: 'New Arrivals' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'New Arrivals' }).getAttribute('aria-pressed')).toBe('true'))
    expect(screen.getByTestId('location').textContent).toContain('page=1')
    expect(screen.getByTestId('location').textContent).toContain('sort=newest')
    expect(screen.getByTestId('location').textContent).toContain('campaign=spring')
    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(['Product 3', 'Product 8'])
  })

  it('paginates while retaining sort and scrolling to the top', async () => {
    const products = Array.from({ length: 10 }, (_, index) => product(10 - index))
    const scrollTo = vi.fn()
    setupCatalog(products)
    renderPage({ entry: '/products?page=1&sort=newest', scrollTo })

    await screen.findByRole('heading', { name: 'Product 10' })
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))

    expect(await screen.findByRole('heading', { name: 'Product 2' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Product 1' })).toBeTruthy()
    expect(screen.getByTestId('location').textContent).toContain('page=2')
    expect(screen.getByTestId('location').textContent).toContain('sort=newest')
    expect(screen.getByText('Showing 9–10 of 10 products')).toBeTruthy()
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })

    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }))
    expect(await screen.findByRole('heading', { name: 'Product 10' })).toBeTruthy()
    expect(screen.getByTestId('location').textContent).toContain('sort=newest')
  })

  it('shows pagination ellipses and navigates directly to a selected page', async () => {
    const products = Array.from({ length: 50 }, (_, index) => product(50 - index))
    setupCatalog(products)
    renderPage({ entry: '/products?page=4&sort=newest' })

    expect(await screen.findByRole('heading', { name: 'Product 26' })).toBeTruthy()
    expect(screen.getAllByText('…')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Page 3' }))

    expect(await screen.findByRole('heading', { name: 'Product 34' })).toBeTruthy()
    expect(screen.getByTestId('location').textContent).toContain('page=3')
  })

  it('clamps an invalid page and normalizes an unknown sort', async () => {
    setupCatalog(Array.from({ length: 9 }, (_, index) => product(index + 1)))
    renderPage({ entry: '/products?page=99&sort=popular' })

    expect(await screen.findByRole('heading', { name: 'Product 9' })).toBeTruthy()
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/products?page=2&sort=recommended'))
    expect(screen.getByRole('button', { name: 'Next page' }).disabled).toBe(true)
  })

  it('fetches additional catalogue pages and normalizes product fields', async () => {
    const calls = []
    apiClient.get.mockImplementation((path) => {
      calls.push(path)
      if (path.includes('/client/categories?')) return Promise.resolve({ data: { categories: [] } })
      if (path.includes('page=1')) return Promise.resolve(payload([product(1, { image: '', imageUrl: '/fallback.jpg', originalPrice: null, compareAtPrice: 40 })], 2))
      return Promise.resolve(payload([product(2)]))
    })
    renderPage()

    expect(await screen.findByRole('img', { name: 'Product 1' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Product 1' }).getAttribute('src')).toBe('/fallback.jpg')
    expect(screen.getByText('$40').className).toContain('line-through')
    expect(screen.getByRole('heading', { name: 'Product 2' })).toBeTruthy()
    expect(calls).toContain('/client/products?page=2&limit=50&lang=EN')
  })

  it('uses API category names and keeps the first matching category for a product', async () => {
    const categories = [
      { slug: 'men', categoryName: 'Men' },
      { slug: 'women', categoryName: 'Women' },
    ]
    apiClient.get.mockImplementation((path) => {
      if (path.startsWith('/client/products?')) return Promise.resolve(payload([product(1)]))
      if (path.startsWith('/client/categories?')) return Promise.resolve({ data: { categories } })
      if (path.includes('/category/men')) return Promise.resolve({ data: { products: [product(1, { category: { name: 'Men', slug: 'men' } })], pagination: { totalPages: 1 } } })
      if (path.includes('/category/women')) return Promise.resolve({ data: { products: [product(1, { category: { name: 'Women', slug: 'women' } })], pagination: { totalPages: 1 } } })
      return Promise.resolve(payload([]))
    })
    renderPage()
    expect(await screen.findByText('Men')).toBeTruthy()
    expect(screen.queryByText('Women')).toBeNull()
  })

  it('tolerates failed category requests and category product requests', async () => {
    apiClient.get.mockImplementation((path) => {
      if (path.startsWith('/client/products?')) return Promise.resolve(payload([product(2)]))
      if (path.startsWith('/client/categories?')) return Promise.resolve({ data: { categories: [{ slug: 'men', categoryName: 'Men' }] } })
      return Promise.reject(new Error('category products unavailable'))
    })
    renderPage()
    expect(await screen.findByText('Uncategorized')).toBeTruthy()

    apiClient.get.mockImplementation((path) => {
      if (path.startsWith('/client/products?')) return Promise.resolve(payload([product(3)]))
      return Promise.reject(new Error('categories unavailable'))
    })
    cleanup()
    renderPage()
    expect(await screen.findByText('Uncategorized')).toBeTruthy()
  })

  it('shows an empty state for an empty catalogue', async () => {
    setupCatalog([])
    renderPage()

    expect(await screen.findByText('No products are available right now.')).toBeTruthy()
    expect(screen.getByText('0 items')).toBeTruthy()
    expect(screen.getByText('Showing 0–0 of 0 products')).toBeTruthy()
  })

  it.each([
    ['a rejected request', () => apiClient.get.mockRejectedValue(new Error('offline'))],
    ['an invalid response', () => apiClient.get.mockResolvedValue({ data: { products: null } })],
  ])('shows an error for %s', async (_description, configureApi) => {
    configureApi()
    renderPage()

    expect((await screen.findByRole('alert')).textContent).toContain('Products could not be loaded')
    expect(screen.queryByText('No products are available right now.')).toBeNull()
  })

  it('shows an error if a later API page has an invalid product list', async () => {
    apiClient.get.mockImplementation((path) => {
      if (path.startsWith('/client/products?')) {
        return path.includes('page=1')
          ? Promise.resolve(payload([product(1)], 2))
          : Promise.resolve({ data: { products: null } })
      }
      return Promise.resolve({ data: { categories: [] } })
    })
    renderPage()

    expect((await screen.findByRole('alert')).textContent).toContain('Products could not be loaded')
  })
})
