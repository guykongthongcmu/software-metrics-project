import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'
import AdminProductsPage from '../../pages/admin/AdminProductsPage.jsx'
import AdminProductFormPage from '../../pages/admin/AdminProductFormPage.jsx'
import App from '../../App.jsx'

vi.mock('../../lib/apiClient.js', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }))

const categories = { data: { categories: [
  { categoryId: 1, categoryName: 'Women', slug: 'women', parentCategoryId: null },
  { categoryId: 2, categoryName: 'Men', slug: 'men', parentCategoryId: null },
  { categoryId: 3, categoryName: 'Child', slug: 'men-shirts', parentCategoryId: 2 },
  { categoryId: 4, categoryName: 'Tag', slug: 'tag-sale', parentCategoryId: null },
] } }
const product = { productId: 8, name: 'Linen Top', description: 'Soft linen', status: 'ACTIVE', priceFrom: 55, variants: [{ sku: 'LIN-M-BEIGE', colour: 'Beige', size: 'M', price: 50, compareAtPrice: 60, stockQty: 5 }], categories: [{ categoryId: 2, name: 'Men Shirts', isPrimary: true }], media: [{ productMediaId: 2, publicUrl: '/images/linen.jpg', altText: 'Linen Top' }] }

function renderList() { return render(<MemoryRouter initialEntries={['/admin/products']}><Routes><Route path="/admin/products" element={<AdminProductsPage />} /><Route path="/admin/products/edit/:id" element={<p>Product editor</p>} /></Routes></MemoryRouter>) }
function renderCreate() { return render(<MemoryRouter initialEntries={['/admin/products/create']}><Routes><Route path="/admin/products/create" element={<AdminProductFormPage />} /><Route path="/admin/products" element={<p>Products route</p>} /></Routes></MemoryRouter>) }
function renderEdit() { return render(<MemoryRouter initialEntries={['/admin/products/edit/8']}><Routes><Route path="/admin/products/edit/:id" element={<AdminProductFormPage />} /><Route path="/admin/products" element={<p>Products route</p>} /></Routes></MemoryRouter>) }
const paged = (items = [row], totalPages = 1, totalItems = items.length) => ({ data: { items, totalPages, totalItems, page: 1 } })
const row = { productId: 8, name: 'Linen Top', rootCategoryName: 'Men', productType: 'TOP', totalStock: 5, priceFrom: 50 }

describe('Admin product catalog and editor', () => {
  beforeEach(() => {
    apiClient.get.mockReset(); apiClient.post.mockReset(); apiClient.put.mockReset()
    URL.createObjectURL = vi.fn(() => `blob:preview-${Math.random()}`)
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(window, 'alert').mockImplementation(() => {})
  })
  afterEach(() => { cleanup(); vi.restoreAllMocks() })

  it('loads product rows and root category tabs, routes row clicks to edit', async () => {
    apiClient.get.mockImplementation((path) => Promise.resolve(path === '/admin/categories' ? { data: categories } : paged([row, { ...row, productId: 9, name: 'Sold Out', totalStock: 0 }, { ...row, productId: 10, name: 'In Stock', totalStock: 30 }], 1, 3)))
    renderList()
    expect(await screen.findByText('Linen Top')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Men' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Child' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Tag' })).toBeNull()
    expect(document.querySelector('.admin-stock-badge.low').textContent).toBe('Low Stock (5)')
    expect(document.querySelector('.admin-stock-badge.out').textContent).toBe('Out of Stock (0)')
    expect(document.querySelector('.admin-stock-badge.in').textContent).toBe('In Stock (30)')
    fireEvent.click(screen.getByText('Linen Top'))
    expect(await screen.findByText('Product editor')).toBeTruthy()
    cleanup()
    renderList()
    const inStockRow = (await screen.findByText('In Stock (30)')).closest('tr')
    fireEvent.keyDown(inStockRow, { key: 'Tab' })
    expect(screen.queryByText('Product editor')).toBeNull()
    fireEvent.keyDown(inStockRow, { key: ' ' })
    expect(await screen.findByText('Product editor')).toBeTruthy()
    cleanup()
    apiClient.get.mockImplementation((path) => Promise.resolve(path === '/admin/categories' ? categories : paged([
      { productId: 11, name: 'Fallback item', primaryCategoryName: 'Legacy category', productType: '', totalStock: 'invalid', priceFrom: 12 },
      { productId: 12, name: 'General item', productType: 'BOTTOM', totalStock: 11, priceFrom: 20 },
    ])))
    renderList()
    const fallbackRow = await screen.findByText('Fallback item')
    expect(fallbackRow.closest('tr').textContent).toContain('Legacy category')
    expect(fallbackRow.closest('tr').textContent).toContain('N/A')
    expect((await screen.findByText('General item')).closest('tr').textContent).toContain('General')
    expect(fallbackRow.closest('tr').textContent).toContain('Out of Stock (0)')
  })

  it('sorts fallback categories alphabetically and trims empty and non-empty searches', async () => {
    apiClient.get.mockImplementation((path) => Promise.resolve(path === '/admin/categories' ? { data: { categories: [
      { categoryId: 15, categoryName: 'Zebra', parentCategoryId: null },
      { categoryId: 14, categoryName: 'Alpha', parentCategoryId: null },
    ] } } : paged([row])))
    renderList()
    await screen.findByText('Linen Top')
    const tabs = screen.getByRole('navigation', { name: 'Product categories' }).querySelectorAll('button')
    expect(tabs[1].textContent).toBe('Alpha')
    expect(tabs[2].textContent).toBe('Zebra')
    fireEvent.change(screen.getByLabelText('Search items'), { target: { value: '   ' } })
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/admin/products?page=1&limit=60&lang=EN'))
    fireEvent.change(screen.getByLabelText('Search items'), { target: { value: '  linen  ' } })
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/admin/products?page=1&limit=60&lang=EN&search=linen'), { timeout: 1500 })
  })

  it('ignores catalog responses that arrive after the list unmounts', async () => {
    let resolveCategories
    let rejectProducts
    apiClient.get.mockImplementation((path) => path === '/admin/categories'
      ? new Promise((resolve) => { resolveCategories = resolve })
      : new Promise((_, reject) => { rejectProducts = reject }))
    const view = renderList()
    await waitFor(() => expect(resolveCategories).toBeTypeOf('function'))
    view.unmount()
    resolveCategories(categories)
    rejectProducts(new Error('Late catalog error'))
    await Promise.resolve()
    await Promise.resolve()

    let rejectCategories
    let resolveProducts
    apiClient.get.mockImplementation((path) => path === '/admin/categories'
      ? new Promise((_, reject) => { rejectCategories = reject })
      : new Promise((resolve) => { resolveProducts = resolve }))
    const secondView = renderList()
    await waitFor(() => expect(resolveProducts).toBeTypeOf('function'))
    secondView.unmount()
    rejectCategories(new Error('Late categories error'))
    resolveProducts(paged([row]))
    await Promise.resolve()
    await Promise.resolve()
  })

  it('retries with active filters and displays the generic catalog error when the API has no message', async () => {
    apiClient.get.mockImplementation((path) => path === '/admin/categories' ? Promise.resolve(categories) : Promise.reject(new Error('offline')))
    renderList()
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Men' }))
    fireEvent.change(screen.getByLabelText('Search items'), { target: { value: '  shirt ' } })
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/admin/products?page=1&limit=60&lang=EN&search=shirt&category=2'), { timeout: 1500 })
    apiClient.get.mockImplementation((path) => path === '/admin/categories' ? Promise.resolve(categories) : Promise.reject({}))
    fireEvent.click(screen.getByRole('button', { name: 'Retry Connection' }))
    expect((await screen.findByRole('alert')).textContent).toContain('The server encountered an unexpected condition')
    expect(apiClient.get).toHaveBeenLastCalledWith('/admin/products?page=1&limit=60&lang=EN&search=shirt&category=2')
  })

  it('uses an unfiltered product response when category controls return an empty payload', async () => {
    apiClient.get.mockImplementation((path) => Promise.resolve(path === '/admin/categories' ? undefined : { data: { data: { items: [row], pagination: { totalItems: 1, totalPages: 1 } } } }))
    renderList()
    expect(await screen.findByText('Linen Top')).toBeTruthy()
    expect(screen.getByText('Showing 1 - 1 of 1')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Men' })).toBeNull()
  })

  it('creates a default variant without a discount or images', async () => {
    apiClient.get.mockResolvedValue(categories)
    apiClient.post.mockResolvedValue({})
    renderCreate()
    await screen.findByRole('combobox', { name: 'Category' })
    fireEvent.change(screen.getByLabelText('Product Name *'), { target: { value: 'Basic Tee' } })
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Price ($) *'), { target: { value: '25' } })
    fireEvent.change(screen.getByLabelText('Stock *'), { target: { value: '4' } })
    fireEvent.change(screen.getByLabelText('Sub Type (Optional)'), { target: { value: 'T-Shirts & Sweats & Bra Tops' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Product' }))
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledOnce())
    const payload = JSON.parse(apiClient.post.mock.calls[0][1].get('payload'))
    expect(payload.variants).toEqual([{ sku: 'NEW-PROD-SKU', colour: 'DEFAULT', size: 'FREE', price: 25, compareAtPrice: null, stockQty: 4 }])
    expect(payload.media).toEqual([])
  })

  it('loads an edit form with missing product fields and no media', async () => {
    apiClient.get.mockImplementation((path) => Promise.resolve(path === '/admin/categories' ? categories : { data: {} }))
    renderEdit()
    expect(await screen.findByRole('heading', { name: 'Edit Product' })).toBeTruthy()
    expect(screen.getByLabelText('Product Name *')).toHaveProperty('value', '')
    expect(screen.getByLabelText('Price ($) *')).toHaveProperty('value', '')
    expect(screen.getByText('Drag & dropdown or click to upload')).toBeTruthy()
    expect(screen.getByLabelText('Sub Type (Optional)').querySelectorAll('option')).toHaveLength(1)
  })

  it('ignores a product edit response after the form unmounts and handles an absent category response', async () => {
    let resolveProduct
    apiClient.get.mockImplementation((path) => path === '/admin/categories'
      ? Promise.resolve(undefined)
      : new Promise((resolve) => { resolveProduct = resolve }))
    const view = renderEdit()
    await waitFor(() => expect(resolveProduct).toBeTypeOf('function'))
    view.unmount()
    resolveProduct({ data: product })
    await Promise.resolve()
    await Promise.resolve()
    expect(apiClient.get).toHaveBeenCalledWith('/admin/categories')
  })

  it('loads sparse variants and updates an edited product without a selected category', async () => {
    const sparseProduct = { productId: 8, variants: [{ stockQty: null }, { size: 'M', colour: 'Black', stockQty: 2 }] }
    apiClient.get.mockImplementation((path) => Promise.resolve(path === '/admin/categories' ? categories : { data: sparseProduct }))
    apiClient.put.mockResolvedValue({})
    renderEdit()
    await screen.findByRole('heading', { name: 'Edit Product' })
    expect(screen.getByLabelText('Product Name *')).toHaveProperty('value', '')
    expect(screen.getByLabelText('Variant 1 size')).toHaveProperty('value', '')
    expect(screen.getByLabelText('Variant 1 color')).toHaveProperty('value', '')
    fireEvent.change(screen.getByLabelText('Variant 2 size'), { target: { value: 'XL' } })
    fireEvent.change(screen.getByLabelText('Product Name *'), { target: { value: 'Sparse item' } })
    fireEvent.change(screen.getByLabelText('Price ($) *'), { target: { value: '15' } })
    fireEvent.change(screen.getByLabelText('Stock *'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update Product' }))
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/admin/products/8', expect.not.objectContaining({ category_id: expect.anything() })))
  })

  it('covers form keyboard upload, variant validation, and generic create error paths', async () => {
    apiClient.get.mockResolvedValue(categories)
    apiClient.post.mockRejectedValue({ payload: {} })
    renderCreate()
    const uploadZone = await screen.findByRole('button', { name: 'Drag and drop or click to upload product images' })
    const picker = screen.getByLabelText('Product images')
    const clickSpy = vi.spyOn(picker, 'click')
    fireEvent.change(picker, { target: { files: null } })
    fireEvent.keyDown(uploadZone, { key: 'Tab' })
    expect(clickSpy).not.toHaveBeenCalled()
    uploadZone.focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard(' ')
    expect(clickSpy).toHaveBeenCalledTimes(2)
    fireEvent.change(screen.getByLabelText('New variant size'), { target: { value: 'M' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add variant' }))
    expect(window.alert).toHaveBeenCalledWith('Please enter both size and color')
    fireEvent.change(screen.getByLabelText('Product Name *'), { target: { value: 'No category item' } })
    fireEvent.change(screen.getByLabelText('Price ($) *'), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText('Stock *'), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Product' }))
    expect(await screen.findByText('Unable to save product.')).toBeTruthy()
    const payload = JSON.parse(apiClient.post.mock.calls[0][1].get('payload'))
    expect(payload.variants[0]).toMatchObject({ price: 0, compareAtPrice: null, stockQty: 0 })
  })

  it('displays API errors from the errors field and uses a fallback message', async () => {
    apiClient.get.mockResolvedValue(categories)
    apiClient.post.mockRejectedValue({ payload: { errors: { status: 'Status is invalid', sku: 'SKU is invalid', stock: 'Stock is invalid', price: 'Price is invalid', media: 'Media is invalid' } } })
    renderCreate()
    await screen.findByRole('combobox', { name: 'Category' })
    fireEvent.change(screen.getByLabelText('Product Name *'), { target: { value: 'Basic Tee' } })
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Price ($) *'), { target: { value: '25' } })
    fireEvent.change(screen.getByLabelText('Stock *'), { target: { value: '4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Product' }))
    expect(await screen.findByText('Unable to save product.')).toBeTruthy()
    expect(screen.getByText('Status is invalid')).toBeTruthy()
    expect(screen.getByText('SKU is invalid')).toBeTruthy()
    expect(screen.getByText('Stock is invalid')).toBeTruthy()
    expect(screen.getByText('Price is invalid')).toBeTruthy()
    expect(screen.getByText('Media is invalid')).toBeTruthy()
  })

  it('connects the admin products route and create link in the application route map', async () => {
    apiClient.get.mockImplementation((path) => Promise.resolve(path === '/admin/categories' ? categories : paged([row])))
    render(<MemoryRouter initialEntries={['/admin/products']}><App /></MemoryRouter>)
    expect(await screen.findByText('Linen Top')).toBeTruthy()
    fireEvent.click(screen.getByRole('link', { name: /Add Item/ }))
    expect(await screen.findByRole('heading', { name: 'Create Product' })).toBeTruthy()
  })

  it('filters by category, debounces search and pages the results', async () => {
    apiClient.get.mockImplementation((path) => Promise.resolve(path === '/admin/categories' ? categories : paged([row], 2, 70)))
    renderList()
    await screen.findByText('Linen Top')
    fireEvent.click(screen.getByRole('button', { name: 'Men' }))
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/admin/products?page=1&limit=60&lang=EN&category=2'))
    fireEvent.change(screen.getByLabelText('Search items'), { target: { value: 'linen' } })
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/admin/products?page=1&limit=60&lang=EN&search=linen&category=2'), { timeout: 1500 })
    expect(screen.getByText('Showing 1 - 60 of 70')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/admin/products?page=2&limit=60&lang=EN&search=linen&category=2'))
  })

  it('shows an empty state and retries API failures', async () => {
    apiClient.get.mockImplementation((path) => path === '/admin/categories' ? Promise.reject(new Error('Categories unavailable')) : Promise.resolve(paged([], 0, 0)))
    renderList()
    expect(await screen.findByText('No products match your current filters.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Men' })).toBeNull()
    cleanup()
    apiClient.get.mockImplementation((path) => path === '/admin/categories' ? Promise.resolve(categories) : Promise.reject(new Error('Catalog unavailable')))
    renderList()
    expect((await screen.findByRole('alert')).textContent).toContain('Catalog unavailable')
    fireEvent.click(screen.getByRole('button', { name: 'Retry Connection' }))
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/admin/products?page=1&limit=60&lang=EN'))
    apiClient.get.mockImplementation((path) => Promise.resolve(path === '/admin/categories' ? categories : paged([row])))
    fireEvent.click(screen.getByRole('button', { name: 'Retry Connection' }))
    expect(await screen.findByText('Linen Top')).toBeTruthy()
  })

  it('creates a product with image metadata and variants', async () => {
    apiClient.get.mockImplementation((path) => Promise.resolve(path === '/admin/categories' ? categories : undefined))
    apiClient.post.mockResolvedValue({ data: { productId: 10 } })
    renderCreate()
    await screen.findByRole('combobox', { name: 'Category' })
    fireEvent.change(screen.getByLabelText('Product Name *'), { target: { value: 'Linen Top' } })
    fireEvent.change(screen.getByLabelText('Price ($) *'), { target: { value: '50' } })
    fireEvent.change(screen.getByLabelText('Stock *'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Product Name *'), { target: { value: 'Linen Top' } })
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Price ($) *'), { target: { value: '60' } })
    fireEvent.change(screen.getByLabelText('Discount Price ($)'), { target: { value: '50' } })
    fireEvent.change(screen.getByLabelText('Stock *'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'ARCHIVED' } })
    fireEvent.change(screen.getByLabelText('New variant size'), { target: { value: 'M' } })
    fireEvent.change(screen.getByLabelText('New variant color'), { target: { value: 'Beige' } })
    fireEvent.change(screen.getByLabelText('New variant stock'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add variant' }))
    const file = new File(['image-data'], 'linen.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('Product images'), { target: { files: [file] } })
    expect(await screen.findByAltText('Linen Top preview 1')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Create Product' }))
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/admin/products', expect.any(FormData)))
    const body = apiClient.post.mock.calls[0][1]
    const payload = JSON.parse(body.get('payload'))
    expect(payload.status).toBe('INACTIVE')
    expect(payload.variants[0]).toMatchObject({ colour: 'BEIGE', size: 'M', price: 50, compareAtPrice: 60, stockQty: 3 })
    expect(body.getAll('mediaFiles')).toHaveLength(1)
    expect(await screen.findByText('Products route')).toBeTruthy()
  })

  it('validates a missing category and maximum image count', async () => {
    apiClient.get.mockResolvedValue(categories)
    renderCreate()
    await screen.findByRole('combobox', { name: 'Category' })
    fireEvent.change(screen.getByLabelText('Product Name *'), { target: { value: 'Linen Top' } })
    fireEvent.change(screen.getByLabelText('Price ($) *'), { target: { value: '60' } })
    fireEvent.change(screen.getByLabelText('Stock *'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('Product images'), { target: { files: [new File(['a'], '1.png'), new File(['b'], '2.png'), new File(['c'], '3.png'), new File(['d'], '4.png'), new File(['e'], '5.png')] } })
    expect(window.alert).toHaveBeenCalledWith('Maximum 4 images allowed.')
    fireEvent.click(screen.getByRole('button', { name: 'Create Product' }))
    expect(await screen.findByText('Please select a valid category')).toBeTruthy()
    expect(apiClient.post).not.toHaveBeenCalled()
  })

  it('keeps the legacy upload zone interactive and manages variant rows', async () => {
    apiClient.get.mockImplementation((path) => path === '/admin/categories' ? Promise.reject(new Error('Categories unavailable')) : undefined)
    renderCreate()
    const uploadZone = await screen.findByRole('button', { name: 'Drag and drop or click to upload product images' })
    const fileInput = screen.getByLabelText('Product images')
    const clickSpy = vi.spyOn(fileInput, 'click')
    fireEvent.click(uploadZone)
    expect(clickSpy).toHaveBeenCalledOnce()
    const file = new File(['image-data'], 'linen.png', { type: 'image/png' })
    fireEvent.drop(uploadZone, { dataTransfer: { files: [file] } })
    expect(await screen.findByAltText(/preview 1/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Remove image 1' }))
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce()
    expect(screen.getByText('Drag & dropdown or click to upload')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Add variant' }))
    expect(window.alert).toHaveBeenCalledWith('Please enter both size and color')
    fireEvent.change(screen.getByLabelText('New variant size'), { target: { value: 'M' } })
    fireEvent.change(screen.getByLabelText('New variant color'), { target: { value: 'Beige' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add variant' }))
    fireEvent.change(screen.getByLabelText('Variant 1 size'), { target: { value: 'L' } })
    expect(screen.getByLabelText('Variant 1 size')).toHaveProperty('value', 'L')
    fireEvent.click(screen.getByRole('button', { name: 'Remove variant 1' }))
    expect(screen.queryByLabelText('Variant 1 size')).toBeNull()
  })

  it('shows create validation errors from API details', async () => {
    apiClient.get.mockResolvedValue(categories)
    apiClient.post.mockRejectedValue({ message: 'Validation failed', payload: { details: { name: 'Name is required', media: 'At least one image is required' } } })
    renderCreate()
    await screen.findByRole('combobox', { name: 'Category' })
    fireEvent.change(screen.getByLabelText('Product Name *'), { target: { value: 'Linen Top' } })
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Price ($) *'), { target: { value: '60' } })
    fireEvent.change(screen.getByLabelText('Stock *'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Product' }))
    expect(await screen.findByText('Validation failed')).toBeTruthy()
    expect(screen.getByText('Name is required')).toBeTruthy()
    expect(screen.getByText('At least one image is required')).toBeTruthy()
  })

  it('loads and updates only supported product fields', async () => {
    apiClient.get.mockImplementation((path) => Promise.resolve(path === '/admin/categories' ? categories : { data: product }))
    apiClient.put.mockResolvedValue({ data: product })
    renderEdit()
    expect(await screen.findByDisplayValue('Linen Top')).toBeTruthy()
    expect(screen.getByLabelText('Price ($) *')).toHaveProperty('value', '55')
    expect(screen.getByLabelText('Product ID')).toHaveProperty('value', '8')
    expect(screen.getByAltText('Linen Top')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Remove existing image 1' }))
    expect(screen.queryByAltText('Linen Top')).toBeNull()
    fireEvent.change(screen.getByLabelText('Product Name *'), { target: { value: 'Updated Linen Top' } })
    fireEvent.change(screen.getByLabelText('Stock *'), { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update Product' }))
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/admin/products/8', expect.objectContaining({ name: 'Updated Linen Top', category_id: 2, price: 55, stock: 9 })))
    expect(apiClient.put.mock.calls[0][1]).not.toHaveProperty('sku')
    expect(await screen.findByText('Products route')).toBeTruthy()
  })

  it('shows product load errors and API field errors on update', async () => {
    apiClient.get.mockImplementation((path) => Promise.resolve(path === '/admin/categories' ? categories : Promise.reject(new Error('Product unavailable'))))
    renderEdit()
    expect((await screen.findByRole('alert')).textContent).toContain('Product unavailable')
    cleanup()
    apiClient.get.mockImplementation((path) => Promise.resolve(path === '/admin/categories' ? categories : { data: product }))
    apiClient.put.mockRejectedValue({ message: 'Update rejected', payload: { details: { price: 'Invalid price' } } })
    renderEdit()
    await screen.findByDisplayValue('Linen Top')
    fireEvent.click(screen.getByRole('button', { name: 'Update Product' }))
    expect(await screen.findByText('Invalid price')).toBeTruthy()
  })
})
