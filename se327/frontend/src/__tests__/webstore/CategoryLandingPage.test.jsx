import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'
import CategoryLandingPage from '../../pages/webstore/CategoryLandingPage.jsx'
import { storefrontRoutes } from '../../pages/webstore/routes.js'
import { FavoritesProvider } from '../../pages/webstore/partials/FavoritesContext.jsx'

vi.mock('../../lib/apiClient.js', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }))

const categorySlugs = ['men', 'women', 'kids', 'baby', 'unisex']
const categories = categorySlugs.map((slug) => ({ slug, isHidden: false }))
const arrivals = Array.from({ length: 9 }, (_, index) => ({
  productId: index + 1,
  name: `Arrival ${index + 1}`,
  image: `/arrival-${index + 1}.jpg`,
  price: 30 + index,
  inStock: true,
}))
const recommendations = [
  ...arrivals.slice(0, 2),
  ...Array.from({ length: 10 }, (_, index) => ({
    productId: index + 20,
    name: `Best seller ${index + 1}`,
    image: `/seller-${index + 1}.jpg`,
    price: 50 + index,
    inStock: true,
  })),
]

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}</output>
}

function renderLanding(slug) {
  return render(
    <MemoryRouter initialEntries={[`/${slug}`]}>
      <LocationProbe />
      <FavoritesProvider>
        <Routes>
          <Route path={`/${slug}`} element={<CategoryLandingPage category={storefrontRoutes.find((route) => route.path === `/${slug}`)} />} />
          <Route path="/products" element={<p>All products page</p>} />
        </Routes>
      </FavoritesProvider>
    </MemoryRouter>,
  )
}

function setupApi({ visibleCategories = categories, arrivalPayload = { data: { products: arrivals } }, sellerPayload = { data: { products: recommendations } }, categoryError } = {}) {
  apiClient.get.mockImplementation((path) => {
    if (path.startsWith('/client/favorites')) return Promise.resolve({ data: { products: [] } })
    if (path.startsWith('/client/categories')) {
      return categoryError ? Promise.reject(categoryError) : Promise.resolve({ data: { categories: visibleCategories } })
    }
    if (path.includes('/recommendations')) return sellerPayload instanceof Error ? Promise.reject(sellerPayload) : Promise.resolve(sellerPayload)
    return arrivalPayload instanceof Error ? Promise.reject(arrivalPayload) : Promise.resolve(arrivalPayload)
  })
}

describe('CategoryLandingPage', () => {
  beforeEach(() => {
    apiClient.get.mockReset()
  })

  afterEach(() => cleanup())

  it.each([
    ['men', "MEN'S COLLECTION", "MEN'S COLLECTION 2026", '/images/men_banner.png'],
    ['women', "WOMEN'S COLLECTION", "WOMEN'S COLLECTION 2026", '/images/women_banner.png'],
    ['kids', "KIDS' COLLECTION", 'KIDS COLLECTION 2026', '/images/kids_banner.png'],
    ['baby', 'BABY & NEWBORN', 'BABY COLLECTION 2026', '/images/baby_banner.png'],
    ['unisex', 'UNISEX COLLECTION', 'UNISEX COLLECTION 2026', '/images/unisex_banner.png'],
  ])('renders the legacy %s banner, eight newest arrivals and eight excluded best sellers', async (slug, title, subtitle, banner) => {
    setupApi()
    renderLanding(slug)

    const hero = await screen.findByRole('region', { name: title })
    expect(hero.className).toContain('h-[90vh]')
    expect(hero.querySelector('.bg-cover').getAttribute('style')).toContain(banner)
    expect(within(hero).getByText(subtitle)).toBeTruthy()
    expect(within(hero).getByRole('link', { name: 'Explore Collection' }).getAttribute('href')).toBe(`/search?q=${slug}`)

    const arrivalsSection = screen.getByRole('region', { name: 'New arrivals' })
    const sellersSection = screen.getByRole('region', { name: 'Best sellers' })
    expect(within(arrivalsSection).getAllByRole('heading', { level: 3 })).toHaveLength(8)
    expect(within(sellersSection).getAllByRole('heading', { level: 3 })).toHaveLength(8)
    expect(within(arrivalsSection).getByRole('heading', { name: 'New Arrivals' })).toBeTruthy()
    expect(within(sellersSection).getByRole('heading', { name: 'Sale' })).toBeTruthy()
    expect(within(arrivalsSection).getByRole('link', { name: 'View All' }).getAttribute('href')).toBe('#')
    expect(within(arrivalsSection).getByRole('heading', { name: 'Arrival 8' })).toBeTruthy()
    expect(within(arrivalsSection).queryByRole('heading', { name: 'Arrival 9' })).toBeNull()
    expect(within(sellersSection).queryByRole('heading', { name: 'Arrival 1' })).toBeNull()
    expect(within(sellersSection).getByRole('heading', { name: 'Best seller 8' })).toBeTruthy()
    expect(apiClient.get).toHaveBeenCalledWith(`/client/products/category/${slug}?page=1&limit=8&sort=newest&lang=EN`, { redirectOn401: false })
    expect(apiClient.get).toHaveBeenCalledWith(`/client/products/recommendations?category=${slug}&limit=8&context=category&lang=EN&excludeProductIds=1,2,3,4,5,6,7,8`, { redirectOn401: false })
  })

  it('redirects hidden or unavailable categories to all products', async () => {
    setupApi({ visibleCategories: categories.filter((category) => category.slug !== 'kids') })
    renderLanding('kids')
    expect(await screen.findByText('All products page')).toBeTruthy()
    expect(screen.getByTestId('location').textContent).toBe('/products')
    expect(apiClient.get).not.toHaveBeenCalledWith(expect.stringContaining('/client/products/category/kids'), expect.anything())
  })

  it('redirects when a category is explicitly marked hidden', async () => {
    setupApi({ visibleCategories: [{ slug: 'men', isHidden: true }] })
    renderLanding('men')
    expect(await screen.findByText('All products page')).toBeTruthy()
  })

  it('shows a category error when the visibility endpoint fails', async () => {
    setupApi({ categoryError: new Error('offline') })
    renderLanding('women')
    expect((await screen.findByRole('alert')).textContent).toBe('This collection could not be loaded. Please try again later.')
    expect(apiClient.get).not.toHaveBeenCalledWith(expect.stringContaining('/client/products/category/women'), expect.anything())
  })

  it('shows independent errors for arrivals and best sellers and supports empty states', async () => {
    setupApi({ arrivalPayload: new Error('arrivals offline'), sellerPayload: { data: { products: [] } } })
    renderLanding('baby')
    expect(await screen.findByText('New arrivals could not be loaded. Please try again later.')).toBeTruthy()
    expect(screen.getByText('No best sellers are available right now.')).toBeTruthy()
    expect(apiClient.get).toHaveBeenCalledWith('/client/products/recommendations?category=baby&limit=8&context=category&lang=EN', { redirectOn401: false })

    cleanup()
    setupApi({ arrivalPayload: { data: { products: [] } }, sellerPayload: new Error('sellers offline') })
    renderLanding('unisex')
    expect(await screen.findByText('No new arrivals are available right now.')).toBeTruthy()
    expect(await screen.findByText('Best sellers could not be loaded. Please try again later.')).toBeTruthy()
  })

  it('filters products returned by recommendations that overlap arrivals and tolerates malformed payloads', async () => {
    setupApi({ arrivalPayload: { data: { products: arrivals.slice(0, 1) } }, sellerPayload: { data: { products: 'invalid' } } })
    renderLanding('men')
    expect(await screen.findByText('Best sellers could not be loaded. Please try again later.')).toBeTruthy()
    expect(apiClient.get).toHaveBeenCalledWith('/client/products/recommendations?category=men&limit=8&context=category&lang=EN&excludeProductIds=1', { redirectOn401: false })
  })
})
