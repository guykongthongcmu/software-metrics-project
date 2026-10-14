import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'
import AdminDashboardPage from '../../pages/admin/AdminDashboardPage.jsx'

vi.mock('../../lib/apiClient.js', () => ({ apiClient: { get: vi.fn() } }))

const summary = {
  period: { from: '2026-10-12', to: '2026-10-18', granularity: 'day' },
  revenue: { total: 1250.5, growth: 12.5, currency: 'USD' },
  orders: { total: 12, growth: -2.5 },
  productsSold: { total: 21, growth: 5 },
  charts: { labels: ['2026-10-12', '2026-10-13', '2026-10-14'], revenue: [100, 500, 650], orders: [2, 4, 6], productsSold: [3, 7, 11] },
  salesByCategory: [{ label: 'Women', value: 700 }, { label: 'Men', value: 550 }],
  topSellers: [{ productId: 9, label: 'Linen Shirt', category: 'Men', likesCount: 6, salesValue: 12 }],
  uniqueViewers: 1234,
}

function renderDashboard() {
  return render(<MemoryRouter initialEntries={['/admin/dashboard']}><Routes><Route path="/admin/dashboard" element={<AdminDashboardPage />} /><Route path="/admin/products" element={<p>Products list</p>} /><Route path="/admin/products/edit/:id" element={<p>Product editor</p>} /></Routes></MemoryRouter>)
}

describe('AdminDashboardPage', () => {
  beforeEach(() => apiClient.get.mockReset())
  afterEach(cleanup)

  it('loads dashboard widgets and renders KPI, charts, sellers, and viewer count', async () => {
    apiClient.get.mockResolvedValue({ data: summary })
    renderDashboard()
    expect(await screen.findByText('$1,250.50')).toBeTruthy()
    await waitFor(() => expect(screen.queryByText('Loading dashboard...')).toBeNull())
    expect(apiClient.get).toHaveBeenCalledWith('/admin/dashboard/summary?period=weekly')
    expect(screen.getByText('+12.5%')).toBeTruthy()
    expect(screen.getByText('-2.5%')).toBeTruthy()
    expect(screen.getByText('21')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Revenue, orders and products sold over time' })).toBeTruthy()
    expect(screen.getByLabelText('Revenue')).toBeTruthy()
    expect(screen.getByLabelText('Orders')).toBeTruthy()
    expect(screen.getByLabelText('Products sold')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Sales by category' })).toBeTruthy()
    expect(screen.getByText('Women')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Linen Shirt/ }).getAttribute('href')).toBe('/admin/products/edit/9')
    expect(screen.getByText('♥ 6')).toBeTruthy()
    expect(screen.getByText('12 sold')).toBeTruthy()
    expect(screen.getByText('1,234')).toBeTruthy()
    expect(screen.getByText('Trend from 2026-10-12 to 2026-10-18')).toBeTruthy()
  })

  it('reloads data when changing to monthly and formats month labels', async () => {
    apiClient.get.mockResolvedValue({ data: { ...summary, period: { from: '2026-01-01', to: '2026-12-31', granularity: 'month' }, charts: { ...summary.charts, labels: ['2026-01', '2026-02'], revenue: [10, 20], orders: [1, 2], productsSold: [3, 4] } } })
    renderDashboard()
    await screen.findByText('$1,250.50')
    fireEvent.click(screen.getByRole('button', { name: 'Monthly' }))
    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/admin/dashboard/summary?period=monthly'))
    expect(await screen.findByText('Jan 2026')).toBeTruthy()
    expect(screen.getByText('Feb 2026')).toBeTruthy()
  })

  it('validates custom range dates and loads a valid custom range', async () => {
    apiClient.get.mockResolvedValue({ data: summary })
    renderDashboard()
    await screen.findByText('$1,250.50')

    fireEvent.click(screen.getByRole('button', { name: 'Apply range' }))
    expect(screen.getByRole('alert').textContent).toBe('Select both dates to view a custom range.')
    fireEvent.change(screen.getByLabelText('Custom range start'), { target: { value: '2026-10-18' } })
    fireEvent.change(screen.getByLabelText('Custom range end'), { target: { value: '2026-10-12' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply range' }))
    expect(screen.getByRole('alert').textContent).toBe('The start date must be before the end date.')

    fireEvent.change(screen.getByLabelText('Custom range start'), { target: { value: '2026-10-01' } })
    fireEvent.change(screen.getByLabelText('Custom range end'), { target: { value: '2026-10-14' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply range' }))
    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/admin/dashboard/summary?period=custom&from=2026-10-01&to=2026-10-14'))
  })

  it('renders empty category and seller states and safely handles missing chart fields', async () => {
    apiClient.get.mockResolvedValue({ data: { period: {}, charts: { labels: ['not-a-date'], revenue: [0], orders: [], productsSold: [] }, salesByCategory: [{ label: 'No sales', value: 0 }], topSellers: [{ productId: 22 }], uniqueViewers: null } })
    renderDashboard()
    expect(await screen.findByText('No sales data found')).toBeTruthy()
    expect(screen.getByText('not-a-date')).toBeTruthy()
    expect(screen.getByText('Unnamed product')).toBeTruthy()
    expect(screen.getByText('—')).toBeTruthy()
    expect(screen.getByText('0 sold')).toBeTruthy()
    expect(screen.getByText('Unique Viewers').parentElement.querySelector('strong').textContent).toBe('0')
    expect(screen.getByText('Trend for selected period')).toBeTruthy()
  })

  it('handles absent or nested response fields and uses month labels when granularity is omitted', async () => {
    apiClient.get.mockResolvedValueOnce(undefined)
    const { unmount } = renderDashboard()
    expect(await screen.findByText('Trend for selected period')).toBeTruthy()
    expect(screen.getAllByText('No sales data found')).toHaveLength(2)
    unmount()

    apiClient.get.mockResolvedValue({ data: { data: { ...summary, period: {}, charts: { labels: ['2026-03'], revenue: [0], orders: [0], productsSold: [0] }, salesByCategory: null, topSellers: {} } } })
    renderDashboard()
    await screen.findByText('Trend for selected period')
    fireEvent.click(screen.getByRole('button', { name: 'Monthly' }))
    expect(await screen.findByText('Mar 2026')).toBeTruthy()
  })

  it('shows API error messages and clears loading on failure', async () => {
    apiClient.get.mockRejectedValueOnce({ payload: { message: 'Dashboard unavailable' }, message: 'Request failed' })
    renderDashboard()
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Dashboard unavailable')
    await waitFor(() => expect(screen.queryByText('Loading dashboard...')).toBeNull())

    cleanup()
    apiClient.get.mockRejectedValueOnce(new Error('Network unavailable'))
    renderDashboard()
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Network unavailable')
  })

  it('uses the fallback error when an API failure has no message', async () => {
    apiClient.get.mockRejectedValueOnce({})
    renderDashboard()
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Unable to load dashboard data. Please try again.')
  })
})
