import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'
import AdminOrdersPage from '../../pages/admin/AdminOrdersPage.jsx'
import AdminOrderDetailPage from '../../pages/admin/AdminOrderDetailPage.jsx'

vi.mock('../../lib/apiClient.js', () => ({ apiClient: { get: vi.fn(), delete: vi.fn(), patch: vi.fn() } }))

const order = { orderId: 12, userId: 4, status: 'PURCHASED', total: 120, subtotal: 100, shippingFee: 10, vatAmount: 10, createdAt: '2026-03-05T12:30:00Z', updatedAt: '2026-03-06T12:30:00Z', customer: { name: 'Alex Doe', email: 'alex@example.test', userId: 4 }, shippingAddressSnapshot: { fullName: 'Alex Doe', phoneNumber: '123456789', addressLine1: '1 Main Street', addressLine2: '', district: 'Central', province: 'Bangkok', postalCode: '10110', country: 'Thailand' }, items: [{ orderItemId: 1, snapshotProductName: 'Linen Shirt', snapshotColor: 'Mocha', snapshotSize: 'M', quantity: 2, snapshotUnitPrice: 50, lineTotal: 100 }] }

function renderOrders() {
  return render(<MemoryRouter initialEntries={['/admin/orders']}><Routes><Route path="/admin/orders" element={<AdminOrdersPage />} /><Route path="/admin/orders/:id" element={<p>Order details route</p>} /></Routes></MemoryRouter>)
}
function renderDetail() {
  return render(<MemoryRouter initialEntries={['/admin/orders/12']}><Routes><Route path="/admin/orders/:id" element={<AdminOrderDetailPage />} /><Route path="/admin/orders" element={<p>Orders route</p>} /></Routes></MemoryRouter>)
}
function listPayload(items = [order], page = 1, totalPages = 1) { return { data: { items, page, totalPages, totalItems: items.length } } }
function summaryPayload(growth = 4.5) { return { data: { orders: { growth } } } }

describe('Admin order management pages', () => {
  beforeEach(() => {
    apiClient.get.mockReset(); apiClient.delete.mockReset(); apiClient.patch.mockReset()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })
  afterEach(() => { cleanup(); vi.restoreAllMocks() })

  it('shows order rows, count, growth and paging, loading requested pages', async () => {
    apiClient.get.mockImplementation((path) => Promise.resolve(path.startsWith('/admin/orders') ? listPayload([order], 1, 3) : summaryPayload()))
    renderOrders()
    expect(await screen.findByText('ORD-12')).toBeTruthy()
    expect(screen.getByText('User #4')).toBeTruthy()
    expect(screen.getByText('$120.00')).toBeTruthy()
    expect(screen.getByText('+4.5%')).toBeTruthy()
    expect(screen.getByText('Showing page 1 of 3 (1 total items)')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/admin/orders?page=2&limit=7&status=PURCHASED'))
  })

  it('handles empty rows, invalid dates, failed loading and retry', async () => {
    apiClient.get.mockImplementationOnce(() => Promise.resolve(listPayload([{ ...order, createdAt: 'invalid', status: null }]))).mockImplementationOnce(() => Promise.resolve(summaryPayload(-3)))
    renderOrders()
    expect(await screen.findByText('ORD-12')).toBeTruthy()
    expect(screen.getByText('--')).toBeTruthy()
    expect(screen.getByText('-3%')).toBeTruthy()
    cleanup()
    apiClient.get.mockRejectedValueOnce(new Error('Orders unavailable'))
    renderOrders()
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Orders unavailable')
    apiClient.get.mockImplementation((path) => Promise.resolve(path.startsWith('/admin/orders') ? listPayload([], 1, 0) : summaryPayload()))
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('No orders found for this criteria.')).toBeTruthy()
  })

  it('uses empty-list defaults when the list endpoint returns no data object', async () => {
    apiClient.get.mockImplementation((path) => Promise.resolve(path.startsWith('/admin/orders') ? undefined : summaryPayload()))
    renderOrders()
    expect(await screen.findByText('No orders found for this criteria.')).toBeTruthy()
    expect(screen.getByText('Showing 0 total items')).toBeTruthy()
  })

  it('shows a fallback message when the orders request fails without an error message', async () => {
    apiClient.get.mockRejectedValue({})
    renderOrders()
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Failed to load orders')
    apiClient.get.mockRejectedValue({})
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Failed to load orders')
  })

  it('ignores list responses that arrive after the page unmounts', async () => {
    let resolveOrders
    let resolveSummary
    apiClient.get.mockImplementation((path) => new Promise((resolve) => {
      if (path.startsWith('/admin/orders')) resolveOrders = resolve
      else resolveSummary = resolve
    }))
    const view = renderOrders()
    view.unmount()
    await act(async () => {
      resolveOrders(listPayload())
      resolveSummary(summaryPayload())
    })
    expect(apiClient.get).toHaveBeenCalledTimes(2)
  })

  it('confirms and deletes an order, while cancellation leaves it in place', async () => {
    apiClient.get.mockImplementation((path) => Promise.resolve(path.startsWith('/admin/orders') ? listPayload([order]) : summaryPayload()))
    apiClient.delete.mockResolvedValue({})
    renderOrders()
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))
    expect(apiClient.delete).toHaveBeenCalledWith('/admin/orders/12')
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(4))
    window.confirm.mockReturnValue(false)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(apiClient.delete).toHaveBeenCalledTimes(1)
  })

  it('moves back one page after deleting its final row', async () => {
    let deleted = false
    apiClient.get.mockImplementation((path) => {
      if (path.startsWith('/admin/dashboard')) return Promise.resolve(summaryPayload())
      if (path.includes('page=2')) return Promise.resolve(listPayload([order], 2, 2))
      return Promise.resolve(deleted ? listPayload([], 1, 1) : listPayload([order], 1, 2))
    })
    apiClient.delete.mockImplementation(() => { deleted = true; return Promise.resolve({}) })
    render(<MemoryRouter initialEntries={['/admin/orders']}><Routes><Route path="/admin/orders" element={<AdminOrdersPage />} /></Routes></MemoryRouter>)
    await screen.findByText('ORD-12')
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/admin/orders?page=2&limit=7&status=PURCHASED'))
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('No orders found for this criteria.')).toBeTruthy()
    expect(apiClient.get).toHaveBeenCalledWith('/admin/orders?page=1&limit=7&status=PURCHASED')
  })

  it('shows a failure toast when list deletion fails', async () => {
    apiClient.get.mockImplementation((path) => Promise.resolve(path.startsWith('/admin/orders') ? listPayload([order]) : summaryPayload()))
    apiClient.delete.mockRejectedValue(new Error('Delete blocked'))
    window.dispatchEvent = vi.fn()
    renderOrders()
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(window.dispatchEvent).toHaveBeenCalled())
  })

  it('renders order snapshot, customer, totals and editable address', async () => {
    apiClient.get.mockResolvedValue({ data: order })
    apiClient.patch.mockResolvedValue({ data: { ...order, shippingAddressSnapshot: { ...order.shippingAddressSnapshot, province: 'Chiang Mai' } } })
    renderDetail()
    expect(await screen.findByText('Linen Shirt')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete Order' }).querySelector('svg')).toBeTruthy()
    expect(screen.getByText('Alex Doe')).toBeTruthy()
    expect(screen.getByText('alex@example.test')).toBeTruthy()
    expect(screen.getAllByText('$10.00')).toHaveLength(2)
    expect(screen.getByLabelText('Province').value).toBe('Bangkok')
    expect(screen.getByLabelText('District').parentElement.classList.contains('third')).toBe(true)
    expect(screen.getByLabelText('Address Line 1').parentElement.classList.contains('wide')).toBe(true)
    fireEvent.change(screen.getByLabelText('Province'), { target: { value: 'Chiang Mai' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Address Snapshot' }))
    await waitFor(() => expect(apiClient.patch).toHaveBeenCalledWith('/admin/orders/12', { shippingAddressSnapshot: expect.objectContaining({ province: 'Chiang Mai' }) }))
    expect(await screen.findByLabelText('Province')).toHaveProperty('value', 'Chiang Mai')
  })

  it('shows the legacy order-detail loading indicator while the request is pending', () => {
    apiClient.get.mockReturnValue(new Promise(() => {}))
    renderDetail()
    expect(document.querySelector('.admin-order-loading').tagName).toBe('OUTPUT')
    expect(document.querySelector('.admin-order-spinner')).toBeTruthy()
  })

  it('ignores detail responses that arrive after the page unmounts', async () => {
    let resolveOrder
    apiClient.get.mockImplementation(() => new Promise((resolve) => { resolveOrder = resolve }))
    const view = renderDetail()
    view.unmount()
    await act(async () => { resolveOrder({ data: order }) })
    expect(apiClient.get).toHaveBeenCalledWith('/admin/orders/12')
  })

  it('shows empty items and per-field validation returned by the API', async () => {
    apiClient.get.mockResolvedValue({ data: { ...order, items: [] } })
    apiClient.patch.mockRejectedValue({ message: 'Invalid address', payload: { details: { postalCode: 'postal code invalid' } } })
    renderDetail()
    expect(await screen.findByText('No line items found for this order.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Save Address Snapshot' }))
    expect(await screen.findByText('postal code invalid')).toBeTruthy()
  })

  it('uses snapshot defaults for missing customer, date, status, items and address values', async () => {
    apiClient.get.mockResolvedValue({ data: { ...order, customer: null, createdAt: null, updatedAt: 'bad-date', status: '', items: undefined, shippingAddressSnapshot: undefined } })
    renderDetail()
    expect(await screen.findByText('No line items found for this order.')).toBeTruthy()
    expect(screen.getAllByText('--').length).toBeGreaterThan(2)
    expect(screen.getByText('PURCHASED')).toBeTruthy()
    expect(screen.getByLabelText('Full Name')).toHaveProperty('value', '')
    expect(screen.getByText('bad-date')).toBeTruthy()
  })

  it('handles nested API data, missing amounts and keeps edited address when the response omits it', async () => {
    apiClient.get.mockResolvedValue({ data: { data: { ...order, subtotal: null, shippingFee: undefined, vatAmount: 'invalid', total: 0, items: [{ orderItemId: 2, quantity: 0 }] } } })
    apiClient.patch.mockResolvedValue({ data: { data: { ...order, shippingAddressSnapshot: null } } })
    renderDetail()
    expect((await screen.findAllByText('--')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('$0.00').length).toBeGreaterThanOrEqual(3)
    fireEvent.change(screen.getByLabelText('Phone Number'), { target: { value: '987654321' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Address Snapshot' }))
    await waitFor(() => expect(apiClient.patch).toHaveBeenCalled())
    expect(screen.getByLabelText('Phone Number')).toHaveProperty('value', '987654321')
  })

  it('displays load errors and retries the detail request', async () => {
    apiClient.get.mockRejectedValueOnce({ payload: { message: 'Order missing' } }).mockResolvedValueOnce({ data: order })
    renderDetail()
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Order missing')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Linen Shirt')).toBeTruthy()
  })

  it('shows a fallback message when reloading an order fails without an API message', async () => {
    apiClient.get.mockRejectedValueOnce(new Error('Initial failure')).mockRejectedValueOnce({})
    renderDetail()
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Initial failure')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Request failed')
  })

  it('deletes from detail after confirmation and leaves the page on cancel', async () => {
    apiClient.get.mockResolvedValue({ data: order })
    apiClient.delete.mockResolvedValue({})
    renderDetail()
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Order' }))
    expect(await screen.findByText('Orders route')).toBeTruthy()
    expect(apiClient.delete).toHaveBeenCalledWith('/admin/orders/12')
    cleanup()
    apiClient.get.mockResolvedValue({ data: order })
    window.confirm.mockReturnValue(false)
    renderDetail()
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Order' }))
    expect(apiClient.delete).toHaveBeenCalledTimes(1)
  })

  it('shows the delete error message returned by the server', async () => {
    apiClient.get.mockResolvedValue({ data: order })
    apiClient.delete.mockRejectedValue({ payload: { message: 'Order cannot be deleted' } })
    window.dispatchEvent = vi.fn()
    renderDetail()
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Order' }))
    await waitFor(() => expect(window.dispatchEvent).toHaveBeenCalled())
    expect(apiClient.delete).toHaveBeenCalledWith('/admin/orders/12')
  })

  it('falls back to a generic message when address save fails without an API message', async () => {
    apiClient.get.mockResolvedValue({ data: order })
    apiClient.patch.mockRejectedValue({})
    window.dispatchEvent = vi.fn()
    renderDetail()
    fireEvent.click(await screen.findByRole('button', { name: 'Save Address Snapshot' }))
    await waitFor(() => expect(window.dispatchEvent).toHaveBeenCalled())
    const event = window.dispatchEvent.mock.calls[0][0]
    expect(event.detail.message).toBe('Request failed')
  })
})
