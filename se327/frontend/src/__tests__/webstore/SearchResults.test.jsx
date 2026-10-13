import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { apiClient } from '../../lib/apiClient.js'
import SearchPage from '../../pages/webstore/SearchPage.jsx'
import { cleanSearchTest, makeProduct, renderSearchPage, success } from './searchTestUtils.jsx'

vi.mock('../../lib/apiClient.js', () => ({ apiClient: { get: vi.fn() } }))

const categories = ['men', 'women', 'kids', 'baby', 'unisex'].map((slug) => ({ slug, categoryName: slug[0].toUpperCase() + slug.slice(1) }))
const pageData = (products, extra = {}) => success({ products, pagination: { totalPages: 1, totalItems: products.length }, categoryCounts: categories.map(({ slug, categoryName }) => ({ slug, name: categoryName, count: 1 })), ...extra })

beforeEach(() => {
  apiClient.get.mockReset()
  apiClient.get.mockImplementation((path) => path.startsWith('/client/categories')
    ? Promise.resolve(success({ categories }))
    : Promise.resolve(pageData([makeProduct(1)])))
})

afterEach(cleanSearchTest)

describe('search result filters and sorting', () => {
  it('renders catalogue products, category counts, and uses the search endpoint', async () => {
    apiClient.get.mockImplementation((path) => path.startsWith('/client/categories')
      ? Promise.resolve(success({ categories }))
      : Promise.resolve(pageData([makeProduct(1, { image: undefined, imageUrl: '/from-api.jpg', color: ['Lilac'] })])))
    renderSearchPage(<SearchPage />, '/search?q=linen')

    expect(await screen.findByRole('heading', { name: 'linen' })).toBeTruthy()
    expect(screen.getByText('Product 1')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Men (1)' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Women (1)' })).toBeTruthy()
    expect(apiClient.get).toHaveBeenCalledWith('/client/products/search?page=1&limit=50&sort=newest&lang=EN&q=linen', { redirectOn401: false })
  })

  it('changes category and sort while preserving query parameters', async () => {
    renderSearchPage(<SearchPage />, '/search?q=linen&cat=all')
    await screen.findByText('Product 1')
    fireEvent.click(screen.getByRole('button', { name: 'Women (1)' }))
    await waitFor(() => expect(screen.getByTestId('location').textContent).toContain('cat=women'))
    fireEvent.click(screen.getByRole('button', { name: /Sort by: Recommended/ }))
    expect(screen.getByRole('listbox', { name: 'Sort search results' })).toBeTruthy()
    fireEvent.click(screen.getByRole('option', { name: 'Lowest Price' }))
    await waitFor(() => expect(screen.getByTestId('location').textContent).toContain('sort=price_asc'))
    expect(screen.getByTestId('location').textContent).toContain('q=linen')
    expect(apiClient.get.mock.calls.some(([path]) => path.includes('sort=price_asc'))).toBe(true)
  })

  it('uses the category catalogue endpoint and derives category count for category searches', async () => {
    const menData = success({ category: { slug: 'men', categoryName: 'Men' }, products: [makeProduct(2, { category: undefined })], pagination: { totalPages: 1, totalItems: 8 } })
    apiClient.get.mockImplementation((path) => path.startsWith('/client/categories') ? Promise.resolve(success({ categories: [] })) : Promise.resolve(menData))
    renderSearchPage(<SearchPage />, '/search?q=kid')

    expect(await screen.findByText('Product 2')).toBeTruthy()
    expect(apiClient.get).toHaveBeenCalledWith('/client/products/category/kids?page=1&limit=50&sort=newest&lang=EN', { redirectOn401: false })
    expect(screen.getByRole('button', { name: 'All (8)' })).toBeTruthy()
  })

  it('closes the sort menu when clicking outside', async () => {
    renderSearchPage(<SearchPage />, '/search?q=linen')
    await screen.findByText('Product 1')
    fireEvent.click(screen.getByRole('button', { name: /Sort by:/ }))
    expect(screen.getByRole('listbox')).toBeTruthy()
    fireEvent.click(screen.getByRole('heading', { name: 'linen' }))
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
  })

  it('shows category suggestions when search returns no products', async () => {
    apiClient.get.mockImplementation((path) => path.startsWith('/client/categories')
      ? Promise.resolve(success({ categories }))
      : Promise.resolve(pageData([])))
    renderSearchPage(<SearchPage />, '/search?q=notfound')

    expect(await screen.findByText('No results for “notfound”')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Men' }))
    expect(screen.getByTestId('location').textContent).toContain('/search?q=men&cat=men')
  })
})
