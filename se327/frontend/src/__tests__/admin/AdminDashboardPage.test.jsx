import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'
import AdminDashboardPage from '../../pages/admin/AdminDashboardPage.jsx'

// The page reads today's date when the module loads, so the clock is fixed before the imports run.
const fixedNow = vi.hoisted(() => {
  const now = new Date(2026, 9, 14, 12)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(now)
  return now
})

const dayKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const dayButton = (date) => date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
const daysFromNow = (offset) => new Date(fixedNow.getFullYear(), fixedNow.getMonth(), fixedNow.getDate() + offset)
const firstOfMonth = new Date(fixedNow.getFullYear(), fixedNow.getMonth(), 1)

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
const weeklyRange = `${summary.period.from} to ${summary.period.to}`

function renderDashboard() {
  return render(<MemoryRouter initialEntries={['/admin/dashboard']}><Routes><Route path="/admin/dashboard" element={<AdminDashboardPage />} /><Route path="/admin/products" element={<p>Products list</p>} /><Route path="/admin/products/edit/:id" element={<p>Product editor</p>} /></Routes></MemoryRouter>)
}

describe('AdminDashboardPage', () => {
  afterAll(() => vi.useRealTimers())
  beforeEach(() => apiClient.get.mockReset())
  afterEach(cleanup)

  it('loads the legacy KPI, revenue chart, category donut, top sellers and audience widgets', async () => {
    apiClient.get.mockResolvedValue({ data: summary })
    renderDashboard()
    expect(await screen.findByText('$1,250.5')).toBeTruthy()
    expect(apiClient.get).toHaveBeenCalledWith('/admin/dashboard/summary?period=weekly')
    expect(screen.getByText('+12.5%')).toBeTruthy()
    expect(screen.getByText('-2.5%')).toBeTruthy()
    expect(screen.getAllByText('+5.0%')).toHaveLength(3)
    expect(screen.getByText('Total Orders').closest('article').className).toContain('admin-dashboard-kpi')
    expect(screen.getByRole('img', { name: 'Revenue over time' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Revenue over time' }).querySelector('.admin-revenue-line').getAttribute('d')).toContain('C')
    expect(screen.queryByLabelText('Orders')).toBeNull()
    expect(screen.getByText('Mon')).toBeTruthy()
    expect(screen.getByText('650')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Sales by category' })).toBeTruthy()
    expect(screen.getByText('56.0%')).toBeTruthy()
    expect(screen.getByText('44.0%')).toBeTruthy()
    const categoryShares = [...screen.getByRole('img', { name: 'Sales by category' }).querySelectorAll('.admin-donut-label')]
    expect(categoryShares.reduce((sum, label) => sum + Number.parseFloat(label.textContent), 0)).toBe(100)
    expect(screen.getByText('Women')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Linen Shirt/ }).getAttribute('href')).toBe('/admin/products/edit/9')
    expect(screen.getByText('♥ 6')).toBeTruthy()
    expect(screen.getByText('12 sold')).toBeTruthy()
    expect(screen.getByText('1,234')).toBeTruthy()
    expect(screen.getByText('Unique Viewers').parentElement.querySelector('.admin-dashboard-viewers > span svg path').getAttribute('d')).toContain('M16 8')
    expect(screen.getByText('Trend from 2026-10-12 to 2026-10-18')).toBeTruthy()
  })

  it('reloads widgets on monthly selection and formats month labels', async () => {
    apiClient.get.mockResolvedValue({ data: { ...summary, period: { from: '2026-01-01', to: '2026-12-31', granularity: 'month' }, charts: { ...summary.charts, labels: ['2026-01', '2026-02'], revenue: [10, 20], orders: [1, 2], productsSold: [3, 4] } } })
    renderDashboard()
    await screen.findByText('$1,250.5')
    fireEvent.click(screen.getByRole('button', { name: 'Monthly' }))
    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/admin/dashboard/summary?period=monthly'))
    expect(await screen.findByText('Jan 2026')).toBeTruthy()
    expect(screen.getByText('Feb 2026')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Monthly' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('keeps the legacy revenue chart scale when all values are equal', async () => {
    apiClient.get.mockResolvedValue({ data: { ...summary, charts: { ...summary.charts, revenue: [100, 100] } } })
    renderDashboard()
    expect(await screen.findByText('$1,250.5')).toBeTruthy()
    expect(screen.getAllByText('100')).toHaveLength(2)
    expect(screen.getByRole('img', { name: 'Revenue over time' })).toBeTruthy()
  })

  it('shows the growth values from the API instead of deriving them from the chart', async () => {
    apiClient.get.mockResolvedValue({ data: { ...summary, revenue: { total: 90, growth: -33.3 }, orders: { total: 3, growth: 0 }, productsSold: { total: 4, growth: 250 }, charts: { ...summary.charts, revenue: [2000, 1000, 500] } } })
    renderDashboard()
    expect(await screen.findByText('$90')).toBeTruthy()
    expect(screen.getByText('-33.3%')).toBeTruthy()
    expect(screen.getByText('+0.0%')).toBeTruthy()
    expect(screen.getAllByText('+250.0%')).toHaveLength(3)
    expect(screen.getByText('$2.5k')).toBeTruthy()
  })

  it('does not show -100% when the last chart points are still empty', async () => {
    apiClient.get.mockResolvedValue({ data: { ...summary, revenue: { total: 100, growth: 0 }, orders: { total: 1, growth: 0 }, productsSold: { total: 1, growth: 0 }, charts: { ...summary.charts, revenue: [0, 100, 0], orders: [0, 1, 0], productsSold: [0, 1, 0] } } })
    renderDashboard()
    expect(await screen.findByText('$100')).toBeTruthy()
    expect(screen.queryByText('-100.0%')).toBeNull()
    expect(screen.getAllByText('+0.0%')).toHaveLength(5)
  })

  it('treats missing growth values as zero', async () => {
    apiClient.get.mockResolvedValue({ data: { ...summary, revenue: { total: 5 }, orders: undefined, productsSold: undefined } })
    renderDashboard()
    expect(await screen.findByText('$5')).toBeTruthy()
    expect(screen.getAllByText('+0.0%')).toHaveLength(5)
  })

  it('shows the range of the selected period on the date button', async () => {
    apiClient.get.mockResolvedValueOnce({ data: summary })
    renderDashboard()
    expect(await screen.findByRole('button', { name: '2026-10-12 to 2026-10-18' })).toBeTruthy()
    apiClient.get.mockResolvedValueOnce({ data: { ...summary, period: { from: '2026-01-01', to: '2026-12-31', granularity: 'month' } } })
    fireEvent.click(screen.getByRole('button', { name: 'Monthly' }))
    expect(await screen.findByRole('button', { name: '2026-01-01 to 2026-12-31' })).toBeTruthy()
  })

  it('selects a custom range and reloads immediately after the end date', async () => {
    apiClient.get.mockResolvedValue({ data: summary })
    renderDashboard()
    await screen.findByText('$1,250.5')
    fireEvent.click(screen.getByRole('button', { name: weeklyRange }))
    expect(screen.getByLabelText('Select date range')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: dayButton(firstOfMonth) }))
    expect(apiClient.get).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: dayButton(daysFromNow(0)) }))
    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith(`/admin/dashboard/summary?period=custom&from=${dayKey(firstOfMonth)}&to=${dayKey(daysFromNow(0))}`))
    expect(screen.getByRole('button', { name: `${dayKey(firstOfMonth)} to ${dayKey(daysFromNow(0))}` })).toBeTruthy()
    expect(screen.getByText('Oct 12')).toBeTruthy()
  })

  it('orders reversed selections and closes the calendar after the second date', async () => {
    apiClient.get.mockResolvedValue({ data: summary })
    renderDashboard()
    await screen.findByText('$1,250.5')
    fireEvent.click(screen.getByRole('button', { name: weeklyRange }))
    fireEvent.click(screen.getByRole('button', { name: dayButton(daysFromNow(0)) }))
    fireEvent.click(screen.getByRole('button', { name: dayButton(daysFromNow(-2)) }))
    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith(`/admin/dashboard/summary?period=custom&from=${dayKey(daysFromNow(-2))}&to=${dayKey(daysFromNow(0))}`))
    expect(screen.queryByLabelText('Select date range')).toBeNull()
  })

  it('waits for the second date and allows closing the calendar', async () => {
    apiClient.get.mockResolvedValue({ data: summary })
    renderDashboard()
    await screen.findByText('$1,250.5')
    fireEvent.click(screen.getByRole('button', { name: weeklyRange }))
    fireEvent.click(screen.getByRole('button', { name: dayButton(firstOfMonth) }))
    expect(apiClient.get).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: `${dayKey(firstOfMonth)} to …` }))
    expect(screen.queryByLabelText('Select date range')).toBeNull()
  })

  it('keeps the picker open when focus stays inside and closes when focus leaves', async () => {
    apiClient.get.mockResolvedValue({ data: summary })
    const view = renderDashboard()
    await screen.findByText('$1,250.5')
    fireEvent.click(screen.getByRole('button', { name: weeklyRange }))
    const picker = view.container.querySelector('.admin-dashboard-range-wrap')
    fireEvent.blur(picker, { relatedTarget: screen.getByRole('button', { name: 'Previous month' }) })
    expect(screen.getByLabelText('Select date range')).toBeTruthy()
    fireEvent.blur(picker, { relatedTarget: document.body })
    expect(screen.queryByLabelText('Select date range')).toBeNull()
  })

  it('renders fallback categories and seller content for missing or empty API fields', async () => {
    apiClient.get.mockResolvedValue({ data: { period: {}, charts: { labels: ['bad-date'], revenue: [0] }, salesByCategory: [{ label: 'No sales', value: 0 }], topSellers: [{ productId: 22 }], uniqueViewers: null } })
    renderDashboard()
    expect(await screen.findByText('Trend for selected period')).toBeTruthy()
    expect(screen.getByText('bad-date')).toBeTruthy()
    expect(screen.getByText('No sales')).toBeTruthy()
    expect(screen.getByText('Unnamed product')).toBeTruthy()
    expect(screen.getByText('—')).toBeTruthy()
    expect(screen.getByText('0 sold')).toBeTruthy()
    expect(screen.getByText('Unique Viewers').parentElement.querySelector('.admin-kpi-value').textContent).toBe('0')
  })

  it('handles an absent response and nested response payloads', async () => {
    apiClient.get.mockResolvedValueOnce(undefined)
    const { unmount } = renderDashboard()
    expect(await screen.findByText('Trend for selected period')).toBeTruthy()
    expect(screen.getByText('Men')).toBeTruthy()
    unmount()
    apiClient.get.mockResolvedValue({ data: { data: { ...summary, period: {}, charts: { labels: ['2026-03'], revenue: [0] }, salesByCategory: null, topSellers: {} } } })
    renderDashboard()
    expect(await screen.findByText('Trend for selected period')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Monthly' }))
    expect(await screen.findByText('Mar 2026')).toBeTruthy()
  })

  it('renders the empty chart path and fallback chart categories', async () => {
    apiClient.get.mockResolvedValue({ data: { charts: { labels: [], revenue: [] }, salesByCategory: [], topSellers: [] } })
    renderDashboard()
    expect(await screen.findByText('No sales data found')).toBeTruthy()
    expect(screen.getByText('Baby')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Revenue over time' })).toBeTruthy()
  })

  it('shows API error messages and stops loading after failure', async () => {
    const toastListener = vi.fn()
    window.addEventListener('admin:toast', toastListener)
    apiClient.get.mockRejectedValueOnce({ payload: { message: 'Dashboard unavailable' }, message: 'Request failed' })
    renderDashboard()
    await waitFor(() => expect(toastListener).toHaveBeenCalledWith(expect.objectContaining({ detail: expect.objectContaining({ title: 'Dashboard Error', message: 'Dashboard unavailable', type: 'danger' }) })))
    await waitFor(() => expect(screen.queryByText('Loading dashboard...')).toBeNull())
    cleanup()
    apiClient.get.mockRejectedValueOnce(new Error('Network unavailable'))
    renderDashboard()
    await waitFor(() => expect(toastListener).toHaveBeenLastCalledWith(expect.objectContaining({ detail: expect.objectContaining({ title: 'Dashboard Error', message: 'Network unavailable' }) })))
    window.removeEventListener('admin:toast', toastListener)
  })

  it('reports failures when changing the selected period', async () => {
    const toastListener = vi.fn()
    window.addEventListener('admin:toast', toastListener)
    apiClient.get.mockResolvedValueOnce({ data: summary }).mockRejectedValueOnce(new Error('Period unavailable'))
    renderDashboard()
    await screen.findByText('$1,250.5')
    fireEvent.click(screen.getByRole('button', { name: 'Monthly' }))
    await waitFor(() => expect(toastListener).toHaveBeenCalledWith(expect.objectContaining({ detail: expect.objectContaining({ title: 'Dashboard Error', message: 'Period unavailable', type: 'danger' }) })))
    window.removeEventListener('admin:toast', toastListener)
  })

  it('ignores a late initial response after the dashboard unmounts', async () => {
    let resolveRequest
    apiClient.get.mockReturnValue(new Promise((resolve) => { resolveRequest = resolve }))
    const view = renderDashboard()
    view.unmount()
    resolveRequest({ data: summary })
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(1))
  })

  it('uses the fallback message when the API error has no message', async () => {
    const toastListener = vi.fn()
    window.addEventListener('admin:toast', toastListener)
    apiClient.get.mockRejectedValueOnce({})
    renderDashboard()
    await waitFor(() => expect(toastListener).toHaveBeenCalledWith(expect.objectContaining({ detail: expect.objectContaining({ title: 'Dashboard Error', message: 'Unable to load dashboard data. Please try again.' }) })))
    window.removeEventListener('admin:toast', toastListener)
  })
})
