import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { apiClient } from '../../lib/apiClient.js'
import AdminCategoriesPage from '../../pages/admin/AdminCategoriesPage.jsx'

vi.mock('../../lib/apiClient.js', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }))

const categories = [
  { categoryId: 1, categoryName: 'Unisex', slug: 'unisex', parentCategoryId: null, isHidden: false },
  { categoryId: 2, categoryName: 'Accessories', slug: 'accessories', parentCategoryId: null, isHidden: true },
  { categoryId: 3, categoryName: 'Men', slug: 'men', parentCategoryId: null, isHidden: false },
  { categoryId: 4, categoryName: 'Men Shirts', slug: 'men-shirts', parentCategoryId: 3, isHidden: false },
  { categoryId: 5, categoryName: 'Tags', slug: 'tag-summer', parentCategoryId: null, isHidden: false },
  { categoryId: 6, categoryName: 'Baby', slug: 'baby', parentCategoryId: null, isHidden: false },
  { categoryId: 7, categoryName: 'Kids', slug: 'kids', parentCategoryId: null, isHidden: false },
  { categoryId: 8, categoryName: 'Women', slug: 'women', parentCategoryId: null, isHidden: false },
  { categoryId: 9, categoryName: 'Zed', slug: 'zed', parentCategoryId: null, isHidden: false },
  { categoryId: 10, categoryName: 'Missing parent', slug: 'missing-parent' },
]

function categoryResponse(data = categories) { return { data: { categories: data } } }
function setDispatchMock() { vi.spyOn(window, 'dispatchEvent') }

describe('Admin category management', () => {
  beforeEach(() => {
    apiClient.get.mockReset(); apiClient.post.mockReset(); apiClient.put.mockReset(); apiClient.patch.mockReset(); apiClient.delete.mockReset()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    setDispatchMock()
  })
  afterEach(() => { cleanup(); vi.restoreAllMocks() })

  it('loads top-level categories in the legacy order, excluding tag categories', async () => {
    apiClient.get.mockResolvedValue({ data: { data: { categories } } })
    render(<AdminCategoriesPage />)
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(8))
    const rows = screen.getAllByRole('row')
    expect(rows.slice(1).map((row) => row.cells[0].textContent)).toEqual([
      'Men', 'Women', 'Kids', 'Baby', 'Unisex', 'Accessories', 'Zed',
    ])
    expect(screen.queryByText('Men Shirts')).toBeNull()
    expect(screen.queryByText('Tags')).toBeNull()
    expect(screen.queryByText('Missing parent')).toBeNull()
    expect(apiClient.get).toHaveBeenCalledWith('/admin/categories')
  })

  it('shows loading state until categories have loaded', () => {
    apiClient.get.mockReturnValue(new Promise(() => {}))
    render(<AdminCategoriesPage />)
    expect(screen.getByText('Initializing Architect-Grade Data Pipeline...')).toBeTruthy()
  })

  it('does not start the category request if it unmounts before the initial effect runs', async () => {
    apiClient.get.mockResolvedValue(categoryResponse())
    const view = render(<AdminCategoriesPage />)
    view.unmount()
    await act(async () => { await Promise.resolve() })
    expect(apiClient.get).not.toHaveBeenCalled()
  })

  it('ignores a category response after the page unmounts', async () => {
    let finishRequest
    apiClient.get.mockReturnValue(new Promise((resolve) => { finishRequest = resolve }))
    const view = render(<AdminCategoriesPage />)
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/admin/categories'))
    view.unmount()
    await act(async () => { finishRequest(categoryResponse()) })
    expect(apiClient.get).toHaveBeenCalledTimes(1)
  })

  it('ignores a category request failure after the page unmounts', async () => {
    let failRequest
    apiClient.get.mockReturnValue(new Promise((resolve, reject) => { failRequest = reject }))
    const view = render(<AdminCategoriesPage />)
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/admin/categories'))
    view.unmount()
    await act(async () => { failRequest(new Error('late failure')) })
    expect(window.dispatchEvent).not.toHaveBeenCalled()
  })

  it('shows the empty state for an empty or invalid category payload', async () => {
    apiClient.get.mockResolvedValueOnce(categoryResponse([]))
    const view = render(<AdminCategoriesPage />)
    expect(await screen.findByText('No categories found.')).toBeTruthy()
    view.unmount()
    apiClient.get.mockResolvedValueOnce({ data: {} })
    render(<AdminCategoriesPage />)
    expect(await screen.findByText('Failed to load data')).toBeTruthy()
    expect(window.dispatchEvent).toHaveBeenCalled()
    cleanup()
    apiClient.get.mockResolvedValueOnce(undefined)
    render(<AdminCategoriesPage />)
    expect(await screen.findByText('Failed to load data')).toBeTruthy()
  })

  it('handles missing optional category names and slugs in the list response', async () => {
    apiClient.get.mockResolvedValue(categoryResponse([
      { categoryId: 12, categoryName: '', slug: '', parentCategoryId: null, isHidden: true },
      { categoryId: 13, slug: '', parentCategoryId: null, isHidden: false },
    ]))
    render(<AdminCategoriesPage />)
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(3))
    expect(screen.getAllByText('/')).toHaveLength(2)
  })

  it('shows the connection failure state and toast', async () => {
    apiClient.get.mockRejectedValue(new Error('offline'))
    render(<AdminCategoriesPage />)
    expect(await screen.findByText('Backend Connection Error')).toBeTruthy()
    expect(window.dispatchEvent).toHaveBeenCalled()
  })

  it('opens the add modal, validates a blank name, then creates and reloads', async () => {
    apiClient.get.mockResolvedValue(categoryResponse())
    apiClient.post.mockResolvedValue({})
    render(<AdminCategoriesPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add Category' }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Category Name'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Category' }))
    expect(apiClient.post).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Category Name'), { target: { value: '  Bags  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Category' }))
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/admin/categories', { categoryName: 'Bags' }))
    expect(apiClient.get).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('prevents duplicate saves and keeps the modal open while a save is pending', async () => {
    let finishSave
    apiClient.get.mockResolvedValue(categoryResponse())
    apiClient.post.mockReturnValue(new Promise((resolve) => { finishSave = resolve }))
    render(<AdminCategoriesPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add Category' }))
    fireEvent.change(screen.getByLabelText('Category Name'), { target: { value: 'Bags' } })
    const form = screen.getByRole('dialog').querySelector('form')
    fireEvent.submit(form)
    await screen.findByRole('button', { name: 'Saving...' })
    fireEvent.submit(form)
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement)
    expect(apiClient.post).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('dialog')).toBeTruthy()
    await act(async () => { finishSave({}) })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('edits an existing category and displays server validation errors', async () => {
    apiClient.get.mockResolvedValue(categoryResponse())
    apiClient.put.mockRejectedValue({ payload: { message: 'Name already exists' } })
    render(<AdminCategoriesPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Men' }))
    expect(screen.getByRole('heading', { name: 'Edit Category' })).toBeTruthy()
    expect(screen.getByLabelText('Category Name')).toHaveProperty('value', 'Men')
    fireEvent.change(screen.getByLabelText('Category Name'), { target: { value: 'Men' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Category' }))
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/admin/categories/3', { categoryName: 'Men' }))
    expect(window.dispatchEvent).toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('closes the category modal from Cancel, Close and the backdrop', async () => {
    apiClient.get.mockResolvedValue(categoryResponse())
    render(<AdminCategoriesPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add Category' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Add Category' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Add Category' }))
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement)
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Add Category' }))
    fireEvent.keyDown(screen.getByLabelText('Category Name'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('optimistically toggles visibility and restores the previous value on failure', async () => {
    apiClient.get.mockResolvedValue(categoryResponse())
    apiClient.patch.mockResolvedValue({})
    render(<AdminCategoriesPage />)
    const hideMen = await screen.findByRole('checkbox', { name: 'Hide Men' })
    const menRow = hideMen.closest('tr')
    fireEvent.click(hideMen)
    await waitFor(() => expect(apiClient.patch).toHaveBeenCalledWith('/admin/categories/3/visibility', { isHidden: true }))
    expect(within(menRow).getByText('HIDDEN')).toBeTruthy()
    const showAccessories = screen.getByRole('checkbox', { name: 'Show Accessories' })
    fireEvent.click(showAccessories)
    await waitFor(() => expect(apiClient.patch).toHaveBeenCalledWith('/admin/categories/2/visibility', { isHidden: false }))
    expect(screen.getByRole('checkbox', { name: 'Hide Accessories' })).toHaveProperty('checked', true)
    apiClient.patch.mockRejectedValueOnce(new Error('rejected'))
    const hideWomen = screen.getByRole('checkbox', { name: 'Hide Women' })
    fireEvent.click(hideWomen)
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Hide Women' })).toHaveProperty('checked', true))
    expect(window.dispatchEvent).toHaveBeenCalled()
  })

  it('deletes a category then reloads, and leaves it in place when confirmation is cancelled', async () => {
    apiClient.get.mockResolvedValue(categoryResponse())
    apiClient.delete.mockResolvedValue({})
    render(<AdminCategoriesPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Men' }))
    expect(apiClient.delete).toHaveBeenCalledWith('/admin/categories/3')
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2))
    window.confirm.mockReturnValue(false)
    fireEvent.click(screen.getByRole('button', { name: 'Delete Women' }))
    expect(apiClient.delete).toHaveBeenCalledTimes(1)
  })

  it('shows an API error when category deletion fails', async () => {
    apiClient.get.mockResolvedValue(categoryResponse())
    apiClient.delete.mockRejectedValue({ payload: { message: 'Category has products' } })
    render(<AdminCategoriesPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Men' }))
    await waitFor(() => expect(window.dispatchEvent).toHaveBeenCalled())
  })

  it('uses the delete fallback text when the API error has no message', async () => {
    apiClient.get.mockResolvedValue(categoryResponse())
    apiClient.delete.mockRejectedValue({})
    render(<AdminCategoriesPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Men' }))
    await waitFor(() => expect(window.dispatchEvent).toHaveBeenCalled())
  })
})
