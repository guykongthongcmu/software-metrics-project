import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'
import AdminLoginPage from '../../pages/admin/AdminLoginPage.jsx'

vi.mock('../../lib/apiClient.js', () => ({ apiClient: { post: vi.fn() } }))

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}</output>
}

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/admin/login']}>
      <LocationProbe />
      <Routes>
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin/dashboard" element={<p>Admin dashboard</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AdminLoginPage', () => {
  beforeEach(() => {
    apiClient.post.mockReset()
    window.sessionStorage.clear()
    vi.useRealTimers()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('validates required fields and email format without calling the API', () => {
    renderLogin()
    expect(document.title).toBe('Sign In | Admin Panel')
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))
    expect(screen.getByText('Email is required.')).toBeTruthy()
    expect(screen.getByText('Password is required.')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'not-an-email' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))
    expect(screen.getByText('Invalid email format.')).toBeTruthy()
    expect(apiClient.post).not.toHaveBeenCalled()
  })

  it('trims email, stores the admin name and navigates after successful sign in', async () => {
    apiClient.post.mockResolvedValue({ data: { name: 'Store Admin' } })
    renderLogin()
    fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: ' admin@example.com ' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(await screen.findByText('Admin dashboard')).toBeTruthy()
    expect(apiClient.post).toHaveBeenCalledWith('/auth/admin/signin', { email: 'admin@example.com', password: 'secret' }, { redirectOn401: false })
    expect(window.sessionStorage.getItem('adminDisplayName')).toBe('Store Admin')
  })

  it('navigates when sign in succeeds without a returned admin name', async () => {
    apiClient.post.mockResolvedValue({})
    renderLogin()
    fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'admin@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))
    expect(await screen.findByText('Admin dashboard')).toBeTruthy()
    expect(window.sessionStorage.getItem('adminDisplayName')).toBeNull()
  })

  it('shows the matching inline error for each API failure', async () => {
    const errors = [
      [{ status: 400, code: 'INVALID_EMAIL_FORMAT' }, 'Invalid email format.'],
      [{ status: 400 }, 'Check your input and try again.'],
      [{ status: 401 }, 'Incorrect email or password.'],
      [{ status: 403 }, 'Your admin account is inactive. Please contact support.'],
      [{ status: 500 }, 'System error. Please try again later.'],
      [{ status: 429, payload: { message: 'Too many attempts.' } }, 'Too many attempts.'],
      [{ status: 429 }, 'An unexpected error occurred.'],
      [new Error('offline'), 'Unable to connect to the server.'],
    ]

    for (const [error, message] of errors) {
      apiClient.post.mockRejectedValueOnce(error)
      const view = renderLogin()
      fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'admin@example.com' } })
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } })
      fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))
      expect((await screen.findByRole('alert')).textContent).toContain(message)
      expect(screen.getByRole('button', { name: 'Sign In' }).disabled).toBe(false)
      view.unmount()
    }
  })

  it('toggles password visibility and disables fields while the request is pending', async () => {
    let resolveSignIn
    apiClient.post.mockReturnValue(new Promise((resolve) => { resolveSignIn = resolve }))
    renderLogin()
    fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'admin@example.com' } })
    const password = screen.getByLabelText('Password')
    fireEvent.change(password, { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Toggle password visibility' }))
    expect(password.type).toBe('text')
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))
    expect(screen.getByRole('button', { name: /Signing In/ }).disabled).toBe(true)
    expect(screen.getByLabelText('Email Address').disabled).toBe(true)
    resolveSignIn({ data: { name: 'Admin' } })
    await waitFor(() => expect(screen.getByText('Admin dashboard')).toBeTruthy())
  })

  it('shows and clears the expired-session notice', async () => {
    vi.useFakeTimers()
    window.sessionStorage.setItem('adminSessionExpired', 'true')
    renderLogin()
    expect(screen.getByText('Session Expired')).toBeTruthy()
    expect(window.sessionStorage.getItem('adminSessionExpired')).toBeNull()
    await act(async () => vi.advanceTimersByTimeAsync(4000))
    expect(screen.queryByText('Session Expired')).toBeNull()
  })

  it('continues sign in when session storage cannot save the admin name', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage disabled') })
    apiClient.post.mockResolvedValue({ data: { name: 'Admin' } })
    renderLogin()
    fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'admin@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))
    expect(await screen.findByText('Admin dashboard')).toBeTruthy()
    expect(setItem).toHaveBeenCalled()
  })
})
