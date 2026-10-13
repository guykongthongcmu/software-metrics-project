import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'
import HomePage from '../../pages/webstore/HomePage.jsx'
import { FavoritesProvider } from '../../pages/webstore/partials/FavoritesContext.jsx'

vi.mock('../../lib/apiClient.js', () => ({ apiClient: { get: vi.fn() } }))

const arrivalsResponse = {
  data: {
    products: [{
      productId: 62,
      name: 'New linen shirt',
      image: '/images/shirt.jpg',
      price: 80,
      originalPrice: 100,
      discount: { type: 'percentage', value: 20 },
      color: ['White', 'Black'],
      inStock: true,
    }],
  },
}

function renderHome() {
  return render(<MemoryRouter><FavoritesProvider><HomePage /></FavoritesProvider></MemoryRouter>)
}

function setupApi({ arrivals = arrivalsResponse, campaign = { data: { campaigns: [] } } } = {}) {
  apiClient.get.mockImplementation((path) => {
    if (path === '/client/products/new-arrivals') {
      return arrivals instanceof Error ? Promise.reject(arrivals) : Promise.resolve(arrivals)
    }
    return campaign instanceof Error ? Promise.reject(campaign) : Promise.resolve(campaign)
  })
}

describe('HomePage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    apiClient.get.mockReset()
    vi.stubGlobal('scrollTo', vi.fn())
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('loads API new arrivals into shared product cards with sale and colour details', async () => {
    setupApi()
    renderHome()

    expect(await screen.findByRole('heading', { name: 'New linen shirt' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'New linen shirt' }).getAttribute('src')).toBe('/images/shirt.jpg')
    expect(screen.getByText('-20%')).toBeTruthy()
    expect(screen.getByText('100 USD').className).toContain('line-through')
    expect(screen.getByText('80 USD')).toBeTruthy()
    expect(screen.getByLabelText('Available colours: White, Black')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'View All' }).getAttribute('href')).toBe('/products?sort=newest')
  })

  it('accepts the legacy API imageUrl and compareAtPrice fields', async () => {
    setupApi({ arrivals: { data: { products: [{
      productId: 3, name: 'Legacy arrival', imageUrl: '/legacy.jpg', price: 25,
      compareAtPrice: 30, discountPercent: 17, inStock: true,
    }] } } })
    renderHome()

    expect(await screen.findByRole('img', { name: 'Legacy arrival' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Legacy arrival' }).getAttribute('src')).toBe('/legacy.jpg')
    expect(screen.getByText('30 USD')).toBeTruthy()
    expect(screen.getByText('-17%')).toBeTruthy()
  })

  it('shows a loading status while arrivals are pending', async () => {
    let resolveArrivals
    const arrivals = new Promise((resolve) => { resolveArrivals = resolve })
    apiClient.get.mockImplementation((path) => path.includes('new-arrivals') ? arrivals : Promise.resolve({ data: { campaigns: [] } }))
    renderHome()

    expect(screen.getByRole('status').textContent).toContain('Loading new arrivals')
    resolveArrivals(arrivalsResponse)
    expect(await screen.findByRole('heading', { name: 'New linen shirt' })).toBeTruthy()
  })

  it('shows an empty state when the API has no eligible arrivals', async () => {
    setupApi({ arrivals: { data: { products: [] } } })
    renderHome()

    expect(await screen.findByText('No new arrivals are available right now.')).toBeTruthy()
  })

  it.each([
    ['request fails', new Error('offline')],
    ['response has an invalid shape', { data: { products: null } }],
  ])('shows an error when arrivals %s', async (_case, arrivals) => {
    setupApi({ arrivals })
    renderHome()

    expect((await screen.findByRole('alert')).textContent).toContain('New arrivals could not be loaded. Please try again later.')
  })

  it('uses a launched campaign message and its image and collection link', async () => {
    setupApi({ campaign: { data: { campaigns: [{
      name: 'Summer Edit', message: 'Save 20%', bannerImageUrl: '/summer.jpg',
      ctaText: 'Shop Summer', ctaUrl: '/collections/summer',
    }] } } })
    renderHome()

    expect(await screen.findByRole('heading', { name: 'Summer Edit' })).toBeTruthy()
    expect(screen.getByText('Save 20%')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Shop Summer' }).getAttribute('href')).toBe('/collections/summer')
    expect(screen.getByRole('region', { name: 'Summer Edit' }).querySelector('.bg-cover').getAttribute('style')).toContain('/summer.jpg')
  })

  it.each([
    [{ type: 'BEST_SELLER' }, 'Explore our best sellers'],
    [{}, 'Explore the latest collection'],
    [{ type: 'PERCENTAGE_DISCOUNT', discount: { type: 'OTHER', value: 15 } }, '15% OFF'],
    [{ discount: { type: 'PERCENTAGE', value: 10 } }, '10% OFF'],
    [{ type: 'FIXED_DISCOUNT', discount: { type: 'OTHER', value: 5 } }, '$5 OFF'],
    [{ type: 'FIXED_AMOUNT_DISCOUNT', discount: { type: 'OTHER', value: 8 } }, '$8 OFF'],
    [{ discount: { type: 'FIXED', value: 3 } }, '$3 OFF'],
    [{ discount: { type: 'OTHER', value: 3 } }, 'Explore our best sellers'],
  ])('formats campaign offer %#', async (campaign, offer) => {
    setupApi({ campaign: { data: [campaign] } })
    renderHome()

    expect(await screen.findByText(offer)).toBeTruthy()
  })

  it('uses campaign image and defaults for missing campaign fields', async () => {
    setupApi({ campaign: { data: { campaigns: [{ image: '/campaign.jpg' }] } } })
    renderHome()

    expect(await screen.findByRole('heading', { name: 'NEW COLLECTION' })).toBeTruthy()
    expect(screen.getByText('Explore the latest collection')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Explore Collection' }).getAttribute('href')).toBe('/products')
    expect(screen.getByRole('region', { name: 'NEW COLLECTION' }).querySelector('.bg-cover').getAttribute('style')).toContain('/campaign.jpg')
  })

  it('uses the default hero if campaigns are empty, malformed, or fail', async () => {
    for (const campaign of [{ data: { campaigns: [] } }, { data: { campaigns: null } }, new Error('offline')]) {
      setupApi({ campaign })
      const view = renderHome()
      expect(await screen.findByRole('heading', { name: 'NEW COLLECTION' })).toBeTruthy()
      expect(screen.getByText('SPRING/SUMMER COLLECTION 2026')).toBeTruthy()
      view.unmount()
    }
  })

  it('ignores resolved and rejected requests after unmount', async () => {
    const makeDeferred = () => {
      let resolve
      let reject
      const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise
        reject = rejectPromise
      })
      return { promise, resolve, reject }
    }
    const resolvedArrivals = makeDeferred()
    const resolvedCampaign = makeDeferred()
    apiClient.get.mockImplementation((path) => path.includes('new-arrivals') ? resolvedArrivals.promise : resolvedCampaign.promise)
    const resolvedView = renderHome()
    resolvedView.unmount()
    resolvedArrivals.resolve(arrivalsResponse)
    resolvedCampaign.resolve({ data: { campaigns: [] } })
    await Promise.allSettled([resolvedArrivals.promise, resolvedCampaign.promise])
    await new Promise((resolve) => setTimeout(resolve, 0))

    const rejectedArrivals = makeDeferred()
    const rejectedCampaign = makeDeferred()
    apiClient.get.mockImplementation((path) => path.includes('new-arrivals') ? rejectedArrivals.promise : rejectedCampaign.promise)
    const rejectedView = renderHome()
    rejectedView.unmount()
    rejectedArrivals.reject(new Error('offline'))
    rejectedCampaign.reject(new Error('offline'))
    await Promise.allSettled([rejectedArrivals.promise, rejectedCampaign.promise])
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

  it('shows a scroll-to-top button after scrolling past the legacy threshold', async () => {
    setupApi()
    renderHome()
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 301 })
    fireEvent.scroll(window)

    const scrollButton = await screen.findByRole('button', { name: 'Scroll to top' })
    fireEvent.click(scrollButton)
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  })
})
