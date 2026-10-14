import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
    fireEvent.keyDown(inStockRow, { key: 'Enter' })
    expect(await screen.findByText('Product editor')).toBeTruthy()
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
