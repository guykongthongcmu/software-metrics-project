import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'
import ForgotPasswordPage from '../../pages/account/ForgotPasswordPage.jsx'
import ForgotPasswordSuccessPage from '../../pages/account/ForgotPasswordSuccessPage.jsx'
import ResetPasswordPage from '../../pages/account/ResetPasswordPage.jsx'
import ProfilePage from '../../pages/account/ProfilePage.jsx'
import {
  clearFrontendSignedOut,
  consumeMockPasswordResetToken,
  createMockPasswordResetToken,
  endMockAccountSession,
  getMockAccountSession,
  isEndpointUnavailable,
  isFrontendSignedOut,
  markFrontendSignedOut,
  startMockAccountSession,
} from '../../pages/account/mockAccountSession.js'

vi.mock('../../lib/apiClient.js', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  window.sessionStorage.clear()
})

function Location() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}{location.search}</output>
}

function renderRoute(path, element, extraRoutes = []) {
  return render(<MemoryRouter initialEntries={[path]}><Location /><Routes>
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/forgot-password-success" element={<ForgotPasswordSuccessPage />} />
    <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
    <Route path="/account/profile" element={<ProfilePage />} />
    <Route path="/login" element={<p>Login page</p>} />
    <Route path="/" element={<p>Storefront home</p>} />
    {extraRoutes.map(([route, page]) => <Route key={route} path={route} element={page} />)}
    <Route path="*" element={element} />
  </Routes></MemoryRouter>)
}

function submitForm(buttonName) {
  fireEvent.submit(screen.getByRole('button', { name: buttonName }).closest('form'))
}

describe('password recovery pages', () => {
  it('submits a trimmed email and navigates to the success page', async () => {
    apiClient.post.mockResolvedValue({})
    renderRoute('/forgot-password', null)
    fireEvent.change(screen.getByLabelText('Email *'), { target: { value: ' member@example.com ' } })
    submitForm('SUBMIT')
    expect(apiClient.post).toHaveBeenCalledWith('/auth/forgot-password', { email: 'member@example.com' })
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/forgot-password-success'))
  })

  it('creates a demo reset link when the recovery endpoint is unavailable', async () => {
    apiClient.post.mockRejectedValue({ status: 404, code: 'NOT_FOUND' })
    renderRoute('/forgot-password', null)
    fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'member@example.com' } })
    submitForm('SUBMIT')
    expect(await screen.findByText(/Demo mode: no email was sent/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open demo reset link' }).getAttribute('href')).toMatch(/^\/auth\/reset-password\?demo=1&token=/)
  })

  it('shows server errors for recovery requests that are not unavailable', async () => {
    apiClient.post.mockRejectedValue({ status: 429, message: 'Too many requests' })
    renderRoute('/forgot-password', null)
    fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'member@example.com' } })
    submitForm('SUBMIT')
    expect((await screen.findByRole('alert')).textContent).toContain('Too many requests')
  })

  it('renders success state with and without the demo reset link', () => {
    const { unmount } = renderRoute('/forgot-password-success', null)
    expect(screen.getByRole('heading', { name: /We already sent you/ })).toBeTruthy()
    expect(screen.queryByText(/Demo mode:/)).toBeNull()
    unmount()
    renderRoute('/forgot-password-success?demo=1&token=abc 123', null)
    expect(screen.getByText(/Demo mode: no email was sent/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open demo reset link' }).getAttribute('href')).toContain('token=abc%20123')
  })

  it('validates a missing token and mismatched passwords', async () => {
    const { unmount } = renderRoute('/auth/reset-password', null)
    fireEvent.change(screen.getByLabelText('New Password *'), { target: { value: 'password1' } })
    fireEvent.change(screen.getByLabelText('Confirm Password *'), { target: { value: 'password2' } })
    submitForm('RESET PASSWORD')
    expect((await screen.findByRole('alert')).textContent).toContain('missing its token')
    unmount()
    renderRoute('/auth/reset-password?token=abc', null)
    fireEvent.change(screen.getByLabelText('New Password *'), { target: { value: 'password1' } })
    fireEvent.change(screen.getByLabelText('Confirm Password *'), { target: { value: 'password2' } })
    submitForm('RESET PASSWORD')
    expect((await screen.findByRole('alert')).textContent).toContain('Passwords do not match.')
    expect(apiClient.post).not.toHaveBeenCalled()
  })

  it('accepts a valid demo token once and rejects an invalid or reused token', async () => {
    const token = createMockPasswordResetToken('member@example.com')
    const { unmount } = renderRoute(`/auth/reset-password?demo=1&token=${token}`, null)
    fireEvent.change(screen.getByLabelText('New Password *'), { target: { value: 'password1' } })
    fireEvent.change(screen.getByLabelText('Confirm Password *'), { target: { value: 'password1' } })
    submitForm('RESET PASSWORD')
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/login?reset=demo'))
    expect(consumeMockPasswordResetToken(token)).toBe(false)
    unmount()
    renderRoute('/auth/reset-password?demo=1&token=invalid', null)
    fireEvent.change(screen.getByLabelText('New Password *'), { target: { value: 'password1' } })
    fireEvent.change(screen.getByLabelText('Confirm Password *'), { target: { value: 'password1' } })
    submitForm('RESET PASSWORD')
    expect((await screen.findByRole('alert')).textContent).toContain('invalid or has already been used')
  })

  it('posts a valid reset and returns to login', async () => {
    apiClient.post.mockResolvedValue({})
    renderRoute('/auth/reset-password?token=mail-token', null)
    fireEvent.change(screen.getByLabelText('New Password *'), { target: { value: 'password1' } })
    fireEvent.change(screen.getByLabelText('Confirm Password *'), { target: { value: 'password1' } })
    submitForm('RESET PASSWORD')
    expect(apiClient.post).toHaveBeenCalledWith('/auth/reset-password', { token: 'mail-token', new_password: 'password1', confirm_password: 'password1' })
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/login'))
  })

  it('uses an existing demo reset token if the reset endpoint is unavailable', async () => {
    const token = createMockPasswordResetToken('member@example.com')
    apiClient.post.mockRejectedValue({ status: 503, code: 'SERVICE_UNAVAILABLE' })
    renderRoute(`/auth/reset-password?token=${token}`, null)
    fireEvent.change(screen.getByLabelText('New Password *'), { target: { value: 'password1' } })
    fireEvent.change(screen.getByLabelText('Confirm Password *'), { target: { value: 'password1' } })
    submitForm('RESET PASSWORD')
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/login?reset=demo'))
  })

  it('shows reset API errors and preserves an invalid demo token', async () => {
    apiClient.post.mockRejectedValue({ status: 400, message: 'Token expired' })
    renderRoute('/auth/reset-password?token=expired', null)
    fireEvent.change(screen.getByLabelText('New Password *'), { target: { value: 'password1' } })
    fireEvent.change(screen.getByLabelText('Confirm Password *'), { target: { value: 'password1' } })
    submitForm('RESET PASSWORD')
    expect((await screen.findByRole('alert')).textContent).toContain('Token expired')
    expect(screen.getByRole('button', { name: 'RESET PASSWORD' }).disabled).toBe(false)
  })
})

describe('profile page', () => {
  it('shows mock profile fields and signs out locally to the storefront', async () => {
    startMockAccountSession('member@example.com')
    const { unmount } = renderRoute('/account/profile', null)
    expect(await screen.findByRole('heading', { name: 'My Profile' })).toBeTruthy()
    expect(screen.getAllByText('Demo Customer').length).toBe(2)
    expect(screen.getAllByText('member@example.com').length).toBe(2)
    expect(screen.getAllByText('081-234-5678').length).toBe(2)
    expect(screen.getByText('14 May 1998')).toBeTruthy()
    expect(screen.getByText('Verification pending')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }))
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/'))
    expect(getMockAccountSession()).toBeNull()
    expect(isFrontendSignedOut()).toBe(true)
    unmount()
  })

  it('loads a server profile and shows verified status and fallback field values', async () => {
    apiClient.get.mockResolvedValue({ data: { name: 'Rin Sample', email: 'rin@example.com', email_verified: true, created_at: 'bad-date' } })
    renderRoute('/account/profile', null)
    expect(await screen.findByRole('heading', { name: 'My Profile' })).toBeTruthy()
    expect(apiClient.get).toHaveBeenCalledWith('/auth/user/profile', { redirectOn401: false })
    expect(screen.getByText('Email verified')).toBeTruthy()
    expect(screen.getAllByText('Not provided').length).toBeGreaterThan(0)
    expect(screen.getByText('RS')).toBeTruthy()
  })

  it('redirects to login when signed out or when profile loading has no session', async () => {
    markFrontendSignedOut()
    const { unmount } = renderRoute('/account/profile', null)
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/login'))
    unmount()
    clearFrontendSignedOut()
    apiClient.get.mockRejectedValue({ status: 404, code: 'NOT_FOUND' })
    renderRoute('/account/profile', null)
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/login'))
  })

  it('shows a profile error when the server fails unexpectedly', async () => {
    apiClient.get.mockRejectedValue({ status: 500, code: 'DATABASE_FAILURE', message: 'Profile service failed' })
    renderRoute('/account/profile', null)
    expect((await screen.findByRole('alert')).textContent).toContain('Profile service failed')
  })
})

describe('mock account session helpers', () => {
  it('creates, reads, normalizes, and clears a demo profile session', () => {
    const session = startMockAccountSession('  MEMBER@Example.com ')
    expect(session.profile.email).toBe('member@example.com')
    expect(getMockAccountSession()).toEqual(session)
    endMockAccountSession()
    expect(getMockAccountSession()).toBeNull()
    window.sessionStorage.setItem('se327:demo-account-session', '{bad json')
    expect(getMockAccountSession()).toBeNull()
  })

  it('tracks local signed-out state and clears it again', () => {
    expect(isFrontendSignedOut()).toBe(false)
    markFrontendSignedOut()
    expect(isFrontendSignedOut()).toBe(true)
    clearFrontendSignedOut()
    expect(isFrontendSignedOut()).toBe(false)
  })

  it('classifies unavailable endpoints and accepts reset tokens once', () => {
    expect(isEndpointUnavailable({})).toBe(true)
    expect(isEndpointUnavailable({ status: 502 })).toBe(true)
    expect(isEndpointUnavailable({ status: 401, code: 'INVALID_CREDENTIALS' })).toBe(false)
    expect(isEndpointUnavailable({ status: 400, payload: { code: 'CORS_ORIGIN_NOT_ALLOWED' } })).toBe(true)
    const token = createMockPasswordResetToken('member@example.com')
    expect(consumeMockPasswordResetToken('wrong')).toBe(false)
    expect(consumeMockPasswordResetToken(token)).toBe(true)
    expect(consumeMockPasswordResetToken(token)).toBe(false)
    window.sessionStorage.setItem('se327:demo-password-reset', 'broken')
    expect(consumeMockPasswordResetToken(token)).toBe(false)
  })
})
