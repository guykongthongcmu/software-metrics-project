import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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

  it('renders admin routes and redirects legacy admin paths', async () => {
    const { unmount } = render(<MemoryRouter initialEntries={['/admin/products/create']}><App /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'Create product' })).toBeTruthy()
    unmount()
    render(<MemoryRouter initialEntries={['/dashboard']}><App /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeTruthy()
  })

  it('redirects the legacy profile route and renders a not-found page', async () => {
    const { unmount } = render(<MemoryRouter initialEntries={['/profile']}><App /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'My profile' })).toBeTruthy()
    unmount()
    render(<MemoryRouter initialEntries={['/no-such-page']}><App /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeTruthy()
  })
})
