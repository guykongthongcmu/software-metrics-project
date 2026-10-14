import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'
import AdminLayout from '../../pages/admin/AdminLayout.jsx'

vi.mock('../../lib/apiClient.js', () => ({ apiClient: { post: vi.fn() } }))

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}</output>
}

function renderAdmin(initial = '/admin/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <LocationProbe />
      <Routes>
        <Route element={<AdminLayout />}>
          <Route path="/admin/dashboard" element={<p>Dashboard content</p>} />
          <Route path="/admin/orders" element={<p>Orders content</p>} />
          <Route path="/admin/orders/:id" element={<p>Order details content</p>} />
          <Route path="/admin/products" element={<p>Products content</p>} />
          <Route path="/admin/categories" element={<p>Categories content</p>} />
          <Route path="/admin/campaigns/builder" element={<p>Campaign content</p>} />
          <Route path="/admin/unknown" element={<p>Unknown content</p>} />
        </Route>
        <Route path="/admin/login" element={<p>Admin sign in</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AdminLayout', () => {
  beforeEach(() => {
    apiClient.post.mockReset()
    window.localStorage.clear()
    window.sessionStorage.clear()
    window.innerWidth = 1280
    vi.useRealTimers()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders navigation, current title, admin name, and active page state', () => {
    window.sessionStorage.setItem('adminDisplayName', 'Store Admin')
    renderAdmin('/admin/orders/17')
    expect(screen.getByRole('heading', { name: 'Order details' })).toBeTruthy()
    expect(screen.getByText('Store Admin')).toBeTruthy()
    expect(screen.getByText('Order details content')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Orders' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Dashboard' }).getAttribute('aria-current')).toBeNull()
  })

  it('uses the default title for an unknown admin route', () => {
    renderAdmin('/admin/unknown')
    expect(screen.getByRole('heading', { name: 'Admin Panel' })).toBeTruthy()
    expect(screen.getByText('Unknown content')).toBeTruthy()
  })

  it('filters page search, navigates to a result, and displays no matches', async () => {
    renderAdmin()
    const search = screen.getByRole('textbox', { name: 'Search pages' })
    fireEvent.focus(search)
    fireEvent.change(search, { target: { value: 'campaign' } })
    expect(screen.getAllByRole('link', { name: 'Campaign Builder' })).toHaveLength(2)
    fireEvent.click(screen.getAllByRole('link', { name: 'Campaign Builder' })[1])
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/admin/campaigns/builder'))
    expect(search.value).toBe('')

    fireEvent.focus(search)
    fireEvent.change(search, { target: { value: 'no such page' } })
    expect(screen.getByText('No pages found')).toBeTruthy()
    fireEvent.blur(search)
  })

  it('collapses the desktop sidebar and opens then closes mobile navigation', () => {
    const { container } = renderAdmin()
    fireEvent.click(screen.getByRole('button', { name: 'Toggle sidebar' }))
    expect(container.querySelector('.admin-sidebar').className).toContain('is-collapsed')
    expect(window.localStorage.getItem('sidebarCollapsed')).toBe('true')

    window.innerWidth = 600
    fireEvent.click(screen.getByRole('button', { name: 'Toggle sidebar' }))
    expect(container.querySelector('.admin-sidebar').className).toContain('is-open')
    fireEvent.click(screen.getByRole('button', { name: 'Close navigation' }))
    expect(container.querySelector('.admin-sidebar').className).not.toContain('is-open')
  })

  it('shows, dismisses, and auto-clears admin toast notifications', async () => {
    vi.useFakeTimers()
    renderAdmin()
    fireEvent(window, new CustomEvent('admin:toast', { detail: { title: 'Saved', message: 'Changes saved.', type: 'success' } }))
    expect(screen.getByText('Changes saved.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close notification' }))
    expect(screen.queryByText('Changes saved.')).toBeNull()

    act(() => window.showToast('Heads up', 'Toast from page'))
    expect(screen.getByText('Toast from page')).toBeTruthy()
    await act(async () => vi.advanceTimersByTimeAsync(4000))
    expect(screen.queryByText('Toast from page')).toBeNull()
  })

  it('logs out, clears session data, and navigates to admin sign in', async () => {
    apiClient.post.mockResolvedValue({})
    window.localStorage.setItem('token', 'token')
    window.sessionStorage.setItem('adminDisplayName', 'Admin')
    renderAdmin()
    fireEvent.click(screen.getByRole('button', { name: 'Log Out' }))
    expect(await screen.findByText('Admin sign in')).toBeTruthy()
    expect(apiClient.post).toHaveBeenCalledWith('/auth/logout', {}, { redirectOn401: false })
    expect(window.localStorage.length).toBe(0)
    expect(window.sessionStorage.length).toBe(0)
  })

  it('redirects to sign in on expired logout and reports other logout failures', async () => {
    apiClient.post.mockRejectedValueOnce({ status: 401 })
    const first = renderAdmin()
    fireEvent.click(screen.getByRole('button', { name: 'Log Out' }))
    expect(await screen.findByText('Admin sign in')).toBeTruthy()
    first.unmount()

    apiClient.post.mockRejectedValueOnce(new Error('offline'))
    renderAdmin()
    fireEvent.click(screen.getByRole('button', { name: 'Log Out' }))
    expect(await screen.findByText('Logout Failed')).toBeTruthy()
    expect(screen.getByText('offline')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Log Out' }).disabled).toBe(false)
  })
})
