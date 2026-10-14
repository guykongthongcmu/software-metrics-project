import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'
import AboutPage from '../../pages/webstore/AboutPage.jsx'
import ContactPage from '../../pages/webstore/ContactPage.jsx'
import StorefrontFooter from '../../pages/webstore/partials/StorefrontFooter.jsx'

vi.mock('../../lib/apiClient.js', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }))

beforeEach(() => {
  apiClient.get.mockReset()
  apiClient.post.mockReset()
  apiClient.get.mockResolvedValue({ data: null })
  apiClient.post.mockResolvedValue({ data: { sessionRevoked: true } })
})

afterEach(() => cleanup())

function renderPage(Page) {
  return render(<MemoryRouter><Page /></MemoryRouter>)
}

function CurrentPath() {
  return <output aria-label="Current path">{useLocation().pathname}</output>
}

function renderFooterAt(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CurrentPath />
      <Routes><Route path="*" element={<StorefrontFooter />} /></Routes>
    </MemoryRouter>,
  )
}

describe('storefront information pages', () => {
  it('shows the brand story, values and collection link', () => {
    renderPage(AboutPage)

    expect(screen.getByRole('heading', { name: 'CORE & CO' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Our Story' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'The Philosophy' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Timeless Design' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Premium Craft' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Conscious Ethos' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'EXPLORE COLLECTION' }).getAttribute('href')).toBe('/products')
  })

  it('shows store contact methods and the Bangkok map', () => {
    renderPage(ContactPage)

    expect(screen.getByRole('heading', { name: 'Contact Us' })).toBeTruthy()
    expect(screen.getByText(/123 Fashion Ave/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'coreandco2026@gmail.com' }).getAttribute('href')).toBe('mailto:coreandco2026@gmail.com')
    expect(screen.getByRole('link', { name: 'Instagram: @coreandco_official' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Facebook: Core & Co' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Twitter: @coreandco_th' })).toBeTruthy()
    expect(screen.getByTitle('Map to Core & Co in Bangkok').getAttribute('loading')).toBe('lazy')
  })

  it('links to product, information and signed-out membership destinations from the footer', async () => {
    renderPage(StorefrontFooter)

    for (const [label, href] of [['Men', '/men'], ['Women', '/women'], ['Kids', '/kids'], ['Baby', '/baby'], ['Unisex', '/unisex'], ['Home', '/'], ['About', '/about'], ['Contact Us', '/contact'], ['SIGN UP', '/auth/signup'], ['LOG IN', '/login']]) {
      expect((await screen.findByRole('link', { name: label })).getAttribute('href')).toBe(href)
    }
    expect(screen.getByText('© 2026 Core & Co. All rights reserved.')).toBeTruthy()
  })

  it('shows the legacy signed-in message and logs out through the backend', async () => {
    apiClient.get.mockResolvedValue({ data: { email: 'customer@example.com' } })
    renderPage(StorefrontFooter)

    expect(await screen.findByText('You are currently logged in to your account.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'LOG OUT' }))
    expect(apiClient.post).toHaveBeenCalledWith('/auth/logout', {}, { redirectOn401: false })
    expect(await screen.findByRole('link', { name: 'SIGN UP' })).toBeTruthy()
  })

  it('shows guest membership after the profile request fails', async () => {
    apiClient.get.mockRejectedValueOnce(new Error('offline'))
    renderPage(StorefrontFooter)

    expect(await screen.findByRole('link', { name: 'SIGN UP' })).toBeTruthy()
  })

  it('shows guest membership when the profile response has no data', async () => {
    apiClient.get.mockResolvedValueOnce(undefined)
    renderPage(StorefrontFooter)

    expect(await screen.findByRole('link', { name: 'SIGN UP' })).toBeTruthy()
  })

  it('redirects to sign in when logout reports an expired session', async () => {
    apiClient.get.mockResolvedValue({ data: { email: 'customer@example.com' } })
    apiClient.post.mockRejectedValueOnce({ status: 401 })
    renderFooterAt()

    fireEvent.click(await screen.findByRole('button', { name: 'LOG OUT' }))
    await waitFor(() => expect(screen.getByLabelText('Current path').textContent).toBe('/login'))
  })

  it('redirects to sign in when logout reports an unauthorized session code', async () => {
    apiClient.get.mockResolvedValue({ data: { email: 'customer@example.com' } })
    apiClient.post.mockRejectedValueOnce({ status: 403, code: 'UNAUTHORIZED' })
    renderFooterAt()

    fireEvent.click(await screen.findByRole('button', { name: 'LOG OUT' }))
    await waitFor(() => expect(screen.getByLabelText('Current path').textContent).toBe('/login'))
  })

  it('shows the backend logout error and the fallback when no message is provided', async () => {
    apiClient.get.mockResolvedValue({ data: { email: 'customer@example.com' } })
    apiClient.post.mockRejectedValueOnce({ status: 500, message: 'Logout service failed' })
    renderPage(StorefrontFooter)
    fireEvent.click(await screen.findByRole('button', { name: 'LOG OUT' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Logout service failed')

    cleanup()
    apiClient.get.mockResolvedValue({ data: { email: 'customer@example.com' } })
    apiClient.post.mockRejectedValueOnce({ status: 500 })
    renderPage(StorefrontFooter)
    fireEvent.click(await screen.findByRole('button', { name: 'LOG OUT' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Could not sign out. Please try again.')
  })

  it('shows the pending logout state until the backend request finishes', async () => {
    apiClient.get.mockResolvedValue({ data: { email: 'customer@example.com' } })
    let finishLogout
    apiClient.post.mockReturnValue(new Promise((resolve) => { finishLogout = resolve }))
    renderPage(StorefrontFooter)
    fireEvent.click(await screen.findByRole('button', { name: 'LOG OUT' }))

    const pendingButton = screen.getByRole('button', { name: 'LOGGING OUT…' })
    expect(pendingButton.disabled).toBe(true)
    finishLogout({ data: { sessionRevoked: true } })
    expect(await screen.findByRole('link', { name: 'SIGN UP' })).toBeTruthy()
  })

  it('ignores a profile rejection after the footer unmounts', async () => {
    let rejectProfile
    apiClient.get.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectProfile = reject }))
    const footer = renderPage(StorefrontFooter)
    expect(apiClient.get).toHaveBeenCalledWith('/auth/user/profile', { redirectOn401: false })
    footer.unmount()
    rejectProfile(new Error('late failure'))
    await Promise.resolve()
  })

  it('ignores a profile response after the footer unmounts', async () => {
    let resolveProfile
    apiClient.get.mockReturnValueOnce(new Promise((resolve) => { resolveProfile = resolve }))
    const footer = renderPage(StorefrontFooter)
    footer.unmount()
    resolveProfile({ data: { email: 'customer@example.com' } })
    await Promise.resolve()
    expect(apiClient.get).toHaveBeenCalledWith('/auth/user/profile', { redirectOn401: false })
  })
})
