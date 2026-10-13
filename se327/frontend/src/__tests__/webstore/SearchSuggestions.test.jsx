import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { apiClient } from '../../lib/apiClient.js'
import SearchPage from '../../pages/webstore/SearchPage.jsx'
import { cleanSearchTest, makeProduct, renderSearchPage, success } from './searchTestUtils.jsx'

vi.mock('../../lib/apiClient.js', () => ({ apiClient: { get: vi.fn() } }))

const categoryRequest = success({ categories: [{ slug: 'men', categoryName: 'Men' }] })

beforeEach(() => {
  apiClient.get.mockReset()
  apiClient.get.mockImplementation((path) => path.startsWith('/client/categories')
    ? Promise.resolve(categoryRequest)
    : Promise.resolve(success({ suggestions: [] })))
})

afterEach(cleanSearchTest)

describe('search suggestions', () => {
  it('loads up to four product suggestions for the empty search page', async () => {
    const products = Array.from({ length: 5 }, (_, index) => makeProduct(index + 1, {
      name: `Suggestion ${index + 1}`,
      category: { name: 'Men' },
      originalPrice: index === 0 ? 30 : null,
    }))
    apiClient.get.mockImplementation((path) => path.startsWith('/client/categories')
      ? Promise.resolve(categoryRequest)
      : Promise.resolve(success({ suggestions: products })))

    renderSearchPage(<SearchPage />)

    expect(await screen.findByText('Suggestion 1')).toBeTruthy()
    expect(screen.getByText('Suggestion 4')).toBeTruthy()
    expect(screen.queryByText('Suggestion 5')).toBeNull()
    expect(screen.getAllByText('Men').length).toBeGreaterThan(0)
    expect(screen.getByText('$30')).toBeTruthy()
    expect(apiClient.get).toHaveBeenCalledWith('/client/products/search/suggestions?q=a&lang=EN', { redirectOn401: false })
  })

  it('shows the suggestion empty state without rendering a blank page', async () => {
    renderSearchPage(<SearchPage />)

    expect(await screen.findByRole('search')).toBeTruthy()
    expect(screen.queryByText('Loading product suggestions…')).toBeNull()
    expect(screen.getByLabelText('Search products')).toBeTruthy()
  })

  it('shows a useful error when suggestions fail', async () => {
    apiClient.get.mockImplementation((path) => path.startsWith('/client/categories')
      ? Promise.resolve(categoryRequest)
      : Promise.reject(new Error('offline')))

    renderSearchPage(<SearchPage />)

    expect((await screen.findByRole('alert')).textContent).toContain('Search could not be loaded')
  })

  it('submits a trimmed query and navigates to results', async () => {
    apiClient.get.mockImplementation((path) => {
      if (path.startsWith('/client/categories')) return Promise.resolve(categoryRequest)
      if (path.startsWith('/client/products/search?')) return Promise.resolve(success({ products: [], pagination: { totalPages: 1, totalItems: 0 } }))
      return Promise.resolve(success({ suggestions: [] }))
    })
    renderSearchPage(<SearchPage />)
    fireEvent.change(await screen.findByLabelText('Search products'), { target: { value: '  linen  ' } })
    fireEvent.submit(screen.getByRole('search'))

    await waitFor(() => expect(screen.getByTestId('location').textContent).toContain('/search?q=linen'))
  })
})
