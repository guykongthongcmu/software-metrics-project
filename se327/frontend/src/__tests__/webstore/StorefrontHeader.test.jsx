import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'
import StorefrontHeader from '../../pages/webstore/partials/StorefrontHeader.jsx'

vi.mock('../../lib/apiClient.js', () => ({
  apiClient: { get: vi.fn() },
}))

describe('StorefrontHeader', () => {
  let profile
  let cartCount
  let favoriteCount

  beforeEach(() => {
    profile = null
    cartCount = 2
    favoriteCount = 3
    apiClient.get.mockImplementation((path) => {
      if (path === '/auth/user/profile') {
        return profile
          ? Promise.resolve({ data: profile })
          : Promise.reject(new Error('unauthorized'))
      }
      if (path === '/client/cart?lang=EN') {
        return Promise.resolve({ data: { cartSummary: { totalItems: cartCount } } })
      }
      if (path === '/client/favorites?lang=EN') {
        return Promise.resolve({ data: { favoritesCount: favoriteCount } })
      }
      return Promise.reject(new Error(`Unexpected API path: ${path}`))
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  function renderHeader(visibleCategoryRoutes = []) {
    return render(
      <MemoryRouter>
        <StorefrontHeader visibleCategoryRoutes={visibleCategoryRoutes} />
      </MemoryRouter>,
    )
  }

  it('loads live counts and links to login when profile is unauthenticated', async () => {
    renderHeader()

    expect(await screen.findByLabelText('2 cart')).toBeTruthy()
    expect(screen.getByLabelText('3 favorites')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Account' }).getAttribute('href')).toBe('/login')
    expect(apiClient.get).toHaveBeenCalledWith('/auth/user/profile', { redirectOn401: false })
  })

  it('links to the account profile when a user is signed in', async () => {
    profile = { userId: 42, email: 'customer@example.com' }

    renderHeader()

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Account' }).getAttribute('href')).toBe('/account/profile')
    })
  })

  it('updates badge counts after cart and favorites events', async () => {
    renderHeader()

    expect(await screen.findByLabelText('2 cart')).toBeTruthy()
    expect(screen.getByLabelText('3 favorites')).toBeTruthy()

    fireEvent(window, new CustomEvent('storefront:cart-updated', { detail: { count: 5 } }))
    fireEvent(window, new CustomEvent('storefront:favorites-updated', { detail: { favoritesCount: 7 } }))

    expect(await screen.findByLabelText('5 cart')).toBeTruthy()
    expect(screen.getByLabelText('7 favorites')).toBeTruthy()
  })

  it('accepts alternate event count fields and resets missing values to zero', async () => {
    renderHeader()
    expect(await screen.findByLabelText('2 cart')).toBeTruthy()

    fireEvent(window, new CustomEvent('storefront:cart-updated', { detail: { totalItems: 4 } }))
    fireEvent(window, new CustomEvent('storefront:favorites-updated', { detail: { count: 6 } }))
    expect(await screen.findByLabelText('4 cart')).toBeTruthy()
    expect(screen.getByLabelText('6 favorites')).toBeTruthy()

    fireEvent(window, new CustomEvent('storefront:cart-updated', { detail: {} }))
    fireEvent(window, new CustomEvent('storefront:favorites-updated', { detail: null }))
    expect(await screen.findByLabelText('0 cart')).toBeTruthy()
    expect(screen.getByLabelText('0 favorites')).toBeTruthy()
  })

  it('reloads header data after the shared refresh event', async () => {
    renderHeader()
    expect(await screen.findByLabelText('2 cart')).toBeTruthy()
    apiClient.get.mockClear()
    cartCount = 6
    favoriteCount = 8

    fireEvent(window, new Event('storefront:refresh-header'))

    expect(await screen.findByLabelText('6 cart')).toBeTruthy()
    expect(screen.getByLabelText('8 favorites')).toBeTruthy()
    expect(apiClient.get).toHaveBeenCalledTimes(3)
  })

  it('uses zero counts when count requests fail', async () => {
    apiClient.get.mockRejectedValue(new Error('network unavailable'))

    renderHeader()

    expect(await screen.findByLabelText('0 cart')).toBeTruthy()
    expect(screen.getByLabelText('0 favorites')).toBeTruthy()
  })

  it('opens the language menu, changes language, and closes on selection', async () => {
    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: 'EN' }))
    expect(screen.getByRole('menu')).toBeTruthy()
    fireEvent.click(screen.getByRole('menuitem', { name: 'TH' }))

    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.getByRole('button', { name: 'TH' })).toBeTruthy()
  })

  it('closes the language menu on outside pointer and Escape', () => {
    renderHeader()
    fireEvent.click(screen.getByRole('button', { name: 'EN' }))
    expect(screen.getByRole('menu')).toBeTruthy()

    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menu')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'EN' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('opens mobile navigation and its category menu', () => {
    renderHeader([{ path: '/men', title: 'Men' }])

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    const mobileNavigation = screen.getByRole('navigation', { name: 'Mobile navigation' })
    expect(mobileNavigation).toBeTruthy()
    fireEvent.click(within(mobileNavigation).getByRole('button', { name: 'Show Men categories' }))

    expect(screen.getAllByRole('link', { name: 'T-Shirts & Sweatshirts' }).map((link) => link.getAttribute('href')))
      .toEqual([
        '/search?q=t-shirt&cat=men&sort=relevance',
        '/search?q=t-shirt&cat=men&sort=relevance',
      ])
  })

  it('closes the mobile menu after choosing a primary link', () => {
    renderHeader()
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    const mobileNavigation = screen.getByRole('navigation', { name: 'Mobile navigation' })

    fireEvent.click(within(mobileNavigation).getByRole('link', { name: 'Products' }))

    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).toBeNull()
  })

  it('closes the mobile menu from its toggle button', () => {
    renderHeader()
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    expect(screen.getByRole('navigation', { name: 'Mobile navigation' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close menu' }))
    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).toBeNull()
  })

  it('shows mobile account and info links and closes after selection', async () => {
    const firstRender = renderHeader()
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    let mobileNavigation = screen.getByRole('navigation', { name: 'Mobile navigation' })
    expect(within(mobileNavigation).getByRole('link', { name: 'Sign in' }).getAttribute('href'))
      .toBe('/login')
    expect(within(mobileNavigation).getByRole('link', { name: 'About' }).getAttribute('href'))
      .toBe('/about')
    expect(within(mobileNavigation).getByRole('link', { name: 'Contact' }).getAttribute('href'))
      .toBe('/contact')
    fireEvent.click(within(mobileNavigation).getByRole('link', { name: 'About' }))
    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).toBeNull()

    firstRender.unmount()
    profile = { userId: 42, email: 'customer@example.com' }
    renderHeader()
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Account' }).getAttribute('href'))
        .toBe('/account/profile')
    })
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    mobileNavigation = screen.getByRole('navigation', { name: 'Mobile navigation' })
    expect(within(mobileNavigation).getByRole('link', { name: 'My account' }).getAttribute('href'))
      .toBe('/account/profile')
    fireEvent.click(within(mobileNavigation).getByRole('link', { name: 'Contact' }))
    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).toBeNull()
  })

  it('closes the desktop category panel from its overlay', () => {
    renderHeader([{ path: '/men', title: 'Men' }])
    const menLink = screen.getByRole('navigation', { name: 'Main navigation' })
      .querySelector('a[href="/men"]')
    fireEvent.mouseEnter(menLink.parentElement.parentElement)

    const overlay = document.querySelector('button.fixed.inset-0.z-30')
    expect(overlay).toBeTruthy()
    fireEvent.click(overlay)

    expect(document.querySelector('button.fixed.inset-0.z-30')).toBeNull()
  })

  it('refreshes header data when the window regains focus', async () => {
    renderHeader()
    expect(await screen.findByLabelText('2 cart')).toBeTruthy()
    apiClient.get.mockClear()
    cartCount = 9
    favoriteCount = 4

    fireEvent(window, new Event('focus'))

    expect(await screen.findByLabelText('9 cart')).toBeTruthy()
    expect(screen.getByLabelText('4 favorites')).toBeTruthy()
    expect(apiClient.get).toHaveBeenCalledTimes(3)
  })

  it('ignores header data that resolves after unmount', async () => {
    let resolveProfile
    let resolveCart
    let resolveFavorites
    apiClient.get.mockImplementation((path) => new Promise((resolve) => {
      if (path === '/auth/user/profile') resolveProfile = resolve
      if (path === '/client/cart?lang=EN') resolveCart = resolve
      if (path === '/client/favorites?lang=EN') resolveFavorites = resolve
    }))
    const { unmount } = renderHeader()
    unmount()

    resolveProfile({ data: { userId: 42 } })
    resolveCart({ data: { cartSummary: { totalItems: 6 } } })
    resolveFavorites({ data: { favoritesCount: 7 } })
    await Promise.resolve()
    await Promise.resolve()

    expect(screen.queryByLabelText('6 cart')).toBeNull()
  })
})
