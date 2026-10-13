import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'
import ForgotPasswordPage from '../../pages/account/ForgotPasswordPage.jsx'
import ForgotPasswordSuccessPage from '../../pages/account/ForgotPasswordSuccessPage.jsx'
import ResetPasswordPage from '../../pages/account/ResetPasswordPage.jsx'
import ProfilePage from '../../pages/account/ProfilePage.jsx'

vi.mock('../../lib/apiClient.js', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }))

afterEach(() => cleanup())
beforeEach(() => {
  apiClient.get.mockReset()
  apiClient.post.mockReset()
})

function Location() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}{location.search}</output>
}

function renderRoute(path, element = null) {
  return render(<MemoryRouter initialEntries={[path]}><Location /><Routes>
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/forgot-password-success" element={<ForgotPasswordSuccessPage />} />
    <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
    <Route path="/account/profile" element={<ProfilePage />} />
    <Route path="/login" element={<p>Login page</p>} />
    <Route path="/" element={<p>Storefront home</p>} />
    <Route path="*" element={element} />
  </Routes></MemoryRouter>)
}

function submitForm(buttonName) {
  fireEvent.submit(screen.getByRole('button', { name: buttonName }).closest('form'))
}

describe('password recovery pages use backend endpoints', () => {
  it('sends a trimmed email to the forgot-password endpoint', async () => {
    apiClient.post.mockResolvedValue({})
    renderRoute('/forgot-password')
    fireEvent.change(screen.getByLabelText('Email *'), { target: { value: ' member@example.com ' } })
    submitForm('SUBMIT')

    expect(apiClient.post).toHaveBeenCalledWith('/auth/forgot-password', { email: 'member@example.com' })
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/forgot-password-success'))
  })

  it('shows the backend error when forgot-password is unavailable', async () => {
    apiClient.post.mockRejectedValue({ status: 503, message: 'Service unavailable' })
    renderRoute('/forgot-password')
    fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'member@example.com' } })
    submitForm('SUBMIT')

    expect((await screen.findByRole('alert')).textContent).toBe('Service unavailable')
    expect(screen.getByTestId('location').textContent).toBe('/forgot-password')
  })

  it('shows the generic success confirmation without any demo reset link', () => {
    renderRoute('/forgot-password-success?demo=1&token=fake-token')
    expect(screen.getByRole('heading', { name: /We already sent you/ })).toBeTruthy()
    expect(screen.queryByText(/Demo mode/)).toBeNull()
    expect(screen.queryByRole('link', { name: 'Open demo reset link' })).toBeNull()
  })

  it('posts a valid reset token and new password to the backend', async () => {
    apiClient.post.mockResolvedValue({})
    renderRoute('/auth/reset-password?token=mail-token')
    fireEvent.change(screen.getByLabelText('New Password *'), { target: { value: 'password1' } })
    fireEvent.change(screen.getByLabelText('Confirm Password *'), { target: { value: 'password1' } })
    submitForm('RESET PASSWORD')

    expect(apiClient.post).toHaveBeenCalledWith('/auth/reset-password', {
      token: 'mail-token', new_password: 'password1', confirm_password: 'password1',
    })
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/login'))
  })

  it('validates missing reset token and mismatched passwords before making a request', async () => {
    const { unmount } = renderRoute('/auth/reset-password')
    fireEvent.change(screen.getByLabelText('New Password *'), { target: { value: 'password1' } })
    fireEvent.change(screen.getByLabelText('Confirm Password *'), { target: { value: 'password2' } })
    submitForm('RESET PASSWORD')
    expect((await screen.findByRole('alert')).textContent).toContain('missing its token')
    unmount()

    renderRoute('/auth/reset-password?token=mail-token')
    fireEvent.change(screen.getByLabelText('New Password *'), { target: { value: 'password1' } })
    fireEvent.change(screen.getByLabelText('Confirm Password *'), { target: { value: 'password2' } })
    submitForm('RESET PASSWORD')
    expect((await screen.findByRole('alert')).textContent).toContain('Passwords do not match')
    expect(apiClient.post).not.toHaveBeenCalled()
  })

  it('shows the reset endpoint error', async () => {
    apiClient.post.mockRejectedValue({ status: 400, message: 'Token expired' })
    renderRoute('/auth/reset-password?token=expired')
    fireEvent.change(screen.getByLabelText('New Password *'), { target: { value: 'password1' } })
    fireEvent.change(screen.getByLabelText('Confirm Password *'), { target: { value: 'password1' } })
    submitForm('RESET PASSWORD')

    expect((await screen.findByRole('alert')).textContent).toContain('Token expired')
  })
})

describe('profile page uses the authenticated backend session', () => {
  it('loads the backend profile and calls backend logout', async () => {
    apiClient.get.mockResolvedValue({ data: {
      name: 'Rin Sample', email: 'rin@example.com', phone_number: '0812345678',
      date_of_birth: '2000-03-12', email_verified: true, created_at: '2024-01-01T00:00:00Z',
    } })
    apiClient.post.mockResolvedValue({ data: { sessionRevoked: true } })
    renderRoute('/account/profile')

    expect(await screen.findByRole('heading', { name: 'My Profile' })).toBeTruthy()
    expect(apiClient.get).toHaveBeenCalledWith('/auth/user/profile', { redirectOn401: false })
    expect(screen.getAllByText('Rin Sample').length).toBe(2)
    expect(screen.getByText('Email verified')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }))

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/auth/logout', {}, { redirectOn401: false }))
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/'))
  })

  it('redirects to sign in when the profile endpoint returns unauthorized', async () => {
    apiClient.get.mockRejectedValue({ status: 401, code: 'UNAUTHORIZED' })
    renderRoute('/account/profile')
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/login'))
  })

  it('shows a profile error when the backend fails unexpectedly', async () => {
    apiClient.get.mockRejectedValue({ status: 500, message: 'Profile service failed' })
    renderRoute('/account/profile')
    expect((await screen.findByRole('alert')).textContent).toContain('Profile service failed')
  })

  it('keeps the profile visible and reports a backend logout failure', async () => {
    apiClient.get.mockResolvedValue({ data: { name: 'Rin Sample', email: 'rin@example.com' } })
    apiClient.post.mockRejectedValue({ status: 503, message: 'Logout service failed' })
    renderRoute('/account/profile')
    await screen.findByRole('heading', { name: 'My Profile' })
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Logout service failed')
  })
})
