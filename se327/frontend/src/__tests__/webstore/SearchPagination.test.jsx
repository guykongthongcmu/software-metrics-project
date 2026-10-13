import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { apiClient } from '../../lib/apiClient.js'
import SearchPage from '../../pages/webstore/SearchPage.jsx'
import { cleanSearchTest, makeProduct, renderSearchPage, success } from './searchTestUtils.jsx'

vi.mock('../../lib/apiClient.js', () => ({ apiClient: { get: vi.fn() } }))

const categories = [{ slug: 'men', categoryName: 'Men' }]
const rows = Array.from({ length: 25 }, (_, index) => makeProduct(index + 1))

beforeEach(() => {
  apiClient.get.mockReset()
  apiClient.get.mockImplementation((path) => {
    if (path.startsWith('/client/categories')) return Promise.resolve(success({ categories }))
    const page = Number(new URL(`http://local${path}`).searchParams.get('page'))
    const products = page === 1 ? rows.slice(0, 10) : page === 2 ? rows.slice(10, 20) : rows.slice(20)
    return Promise.resolve(success({ products, pagination: { totalPages: 3, totalItems: rows.length } }))
  })
})

afterEach(cleanSearchTest)

describe('search result pagination and failures', () => {
  it('loads backend pages and changes page while keeping sort and category filters', async () => {
    const scrollTo = vi.fn()
    renderSearchPage(<SearchPage />, '/search?q=linen&sort=price_desc&cat=men', { scrollTo })

    expect(await screen.findByText('Product 1')).toBeTruthy()
    expect(apiClient.get).toHaveBeenCalledWith('/client/products/search?page=2&limit=50&sort=price_desc&lang=EN&q=linen', { redirectOn401: false })
    fireEvent.click(screen.getByRole('link', { name: 'Next' }))
    await waitFor(() => expect(screen.getByTestId('location').textContent).toContain('page=2'))
    expect(screen.getByTestId('location').textContent).toContain('sort=price_desc')
    expect(screen.getByTestId('location').textContent).toContain('cat=men')
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
    expect(await screen.findByText('Product 13')).toBeTruthy()
    fireEvent.click(screen.getByRole('link', { name: 'Previous' }))
    await waitFor(() => expect(screen.getByTestId('location').textContent).not.toContain('page=2'))
  })

  it('normalizes invalid sort and page values in the URL', async () => {
    renderSearchPage(<SearchPage />, '/search?q=linen&sort=unknown&page=0')

    expect(await screen.findByText('Product 1')).toBeTruthy()
    await waitFor(() => expect(screen.getByTestId('location').textContent).not.toContain('sort=unknown'))
    expect(screen.getByTestId('location').textContent).not.toContain('page=0')
  })

  it('clamps an oversized page and renders the corresponding page links', async () => {
    renderSearchPage(<SearchPage />, '/search?q=linen&page=99')

    expect(await screen.findByText('Product 25')).toBeTruthy()
    await waitFor(() => expect(screen.getByTestId('location').textContent).toContain('page=3'))
    expect(screen.getByRole('link', { name: 'Page 1' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Page 2' })).toBeTruthy()
  })

  it('renders ellipses and jumps to a distant numbered page', async () => {
    const manyRows = Array.from({ length: 120 }, (_, index) => makeProduct(index + 1))
    apiClient.get.mockImplementation((path) => {
      if (path.startsWith('/client/categories')) return Promise.resolve(success({ categories }))
      const apiPage = Number(new URL(`http://local${path}`).searchParams.get('page'))
      return Promise.resolve(success({
        products: manyRows.slice((apiPage - 1) * 50, apiPage * 50),
        pagination: { totalPages: 3, totalItems: manyRows.length },
      }))
    })
    renderSearchPage(<SearchPage />, '/search?q=linen&page=5')

    expect(await screen.findByText('Product 49')).toBeTruthy()
    expect(screen.getAllByText('…').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Page 5' }).getAttribute('aria-current')).toBe('page')
  })

  it('shows the search error for rejected requests and malformed responses', async () => {
    apiClient.get.mockImplementation((path) => path.startsWith('/client/categories')
      ? Promise.resolve(success({ categories }))
      : Promise.reject(new Error('network error')))
    renderSearchPage(<SearchPage />, '/search?q=broken')
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('Search could not be loaded')

    cleanup()
    apiClient.get.mockImplementation((path) => path.startsWith('/client/categories')
      ? Promise.resolve(success({ categories }))
      : Promise.resolve(success({ results: [] })))
    renderSearchPage(<SearchPage />, '/search?q=malformed')
    expect(await screen.findByRole('alert')).toBeTruthy()
  })

  it('treats a missing suggestion collection as an empty list and tolerates category API errors', async () => {
    apiClient.get.mockImplementation((path) => path.startsWith('/client/categories')
      ? Promise.reject(new Error('category service unavailable'))
      : Promise.resolve(success({})))
    renderSearchPage(<SearchPage />)
    expect(await screen.findByRole('search')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Product suggestions' })).toBeNull()
  })
})
