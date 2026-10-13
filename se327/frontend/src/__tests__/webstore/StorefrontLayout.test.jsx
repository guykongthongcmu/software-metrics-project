import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'
import StorefrontLayout from '../../pages/webstore/StorefrontLayout.jsx'

vi.mock('../../lib/apiClient.js', () => ({ apiClient: { get: vi.fn() } }))
vi.mock('../../pages/webstore/partials/StorefrontHeader.jsx', () => ({
  default: ({ visibleCategoryRoutes }) => <div data-testid="categories">{visibleCategoryRoutes.map((route) => route.path).join(',')}</div>,
}))
vi.mock('../../pages/webstore/partials/StorefrontFooter.jsx', () => ({ default: () => <footer>Store footer</footer> }))
vi.stubGlobal('scrollTo', vi.fn())

function LocationPage() {
  const location = useLocation()
  return <div>{location.pathname}{location.search}</div>
}

function renderAt(path) {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route element={<StorefrontLayout />}><Route path="*" element={<LocationPage />} /></Route></Routes></MemoryRouter>)
}

afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('StorefrontLayout', () => {
  it('loads visible category routes, normalizes kid, and ignores hidden and unknown categories', async () => {
    apiClient.get.mockResolvedValue({ data: { categories: [
      { slug: ' kid ' }, { slug: 'MEN' }, { slug: 'women', isHidden: true }, { slug: 'custom' },
    ] } })
    renderAt('/search?q=linen')

    await waitFor(() => expect(screen.getByTestId('categories').textContent).toBe('/men,/kids'))
    expect(document.title).toBe('linen - Search')
    expect(screen.getByText('Store footer')).toBeTruthy()
    expect(apiClient.get).toHaveBeenCalledWith('/client/categories?sort=category_name&order=asc', { redirectOn401: false })
  })

  it('uses route titles and product detail titles, and falls back when categories fail', async () => {
    apiClient.get.mockRejectedValue(new Error('offline'))
    const { unmount } = renderAt('/products/42')
    await waitFor(() => expect(document.title).toBe('Product Details | Core & Co'))
    await waitFor(() => expect(screen.getByTestId('categories').textContent).toBe(''))
    unmount()

    renderAt('/unknown')
    await waitFor(() => expect(document.title).toBe('Page Not Found | Core & Co'))
  })

  it('uses the default search title for a missing or blank query', async () => {
    apiClient.get.mockResolvedValue({ data: { categories: [] } })
    const { unmount } = renderAt('/search')
    await waitFor(() => expect(document.title).toBe('Search'))
    unmount()
    renderAt('/search?q=%20%20')
    await waitFor(() => expect(document.title).toBe('Search'))
  })
})
