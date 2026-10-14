import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../App.jsx'

vi.mock('../lib/apiClient.js', () => ({
  apiClient: {
    get: vi.fn((path) => Promise.resolve(
      path.includes('/new-arrivals') ? { data: { products: [] } }
        : path.includes('/campaigns') ? { data: { campaigns: [] } }
          : { data: { categories: [] } },
    )),
  },
}))
vi.stubGlobal('scrollTo', vi.fn())
afterEach(cleanup)

describe('App routes', () => {
  it('renders the home hero and new arrivals section', async () => {
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'NEW COLLECTION' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'New Arrivals' })).toBeTruthy()
    expect(screen.getByText('No new arrivals are available right now.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Core & Co home' }).getAttribute('href')).toBe('/')
  })

  it('renders the dedicated about and contact pages', async () => {
    const about = render(<MemoryRouter initialEntries={['/about']}><App /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'Our Story' })).toBeTruthy()
    about.unmount()
    render(<MemoryRouter initialEntries={['/contact']}><App /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'Store Information' })).toBeTruthy()
  })

  it('renders the sign-in form at the login route', async () => {
    render(<MemoryRouter initialEntries={['/login']}><App /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'SIGN IN' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Forgot Password?' }).getAttribute('href')).toBe('/forgot-password')
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeTruthy()
    expect(screen.queryByText('© 2026 Core & Co. All rights reserved.')).toBeNull()
  })

  it('renders admin routes and redirects legacy admin paths', async () => {
    const { unmount } = render(<MemoryRouter initialEntries={['/admin/products/create']}><App /></MemoryRouter>)
    expect(await screen.findAllByRole('heading', { name: 'Create product' })).toHaveLength(2)
    unmount()
    render(<MemoryRouter initialEntries={['/admin/login']}><App /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'Admin Panel' })).toBeTruthy()
    cleanup()
    render(<MemoryRouter initialEntries={['/dashboard']}><App /></MemoryRouter>)
    expect(await screen.findAllByRole('heading', { name: 'Dashboard' })).toHaveLength(2)
    expect(screen.getByText("Welcome back! Here's what's happening with your store.")).toBeTruthy()
    expect(await screen.findByRole('heading', { name: 'Revenue Overview' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Dashboard' }).getAttribute('aria-current')).toBe('page')
  })

  it('redirects the legacy profile route and renders a not-found page', async () => {
    const { unmount } = render(<MemoryRouter initialEntries={['/profile']}><App /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'My Profile' })).toBeTruthy()
    unmount()
    render(<MemoryRouter initialEntries={['/no-such-page']}><App /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeTruthy()
  })
})
