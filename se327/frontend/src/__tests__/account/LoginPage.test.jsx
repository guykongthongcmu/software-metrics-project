import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'
import LoginPage from '../../pages/account/LoginPage.jsx'

vi.mock('../../lib/apiClient.js', () => ({ apiClient: { post: vi.fn() } }))

afterEach(() => { cleanup(); vi.clearAllMocks() })

function renderLogin() {
  return render(<MemoryRouter initialEntries={['/login']}><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/" element={<p>Storefront home</p>} />
    <Route path="/forgot-password" element={<p>Forgot password page</p>} />
    <Route path="/auth/signup" element={<p>Sign up page</p>} />
  </Routes></MemoryRouter>)
}

describe('LoginPage', () => {
  it('renders the sign-in form and its recovery and registration links', () => {
    renderLogin()

    expect(screen.getByRole('heading', { name: 'SIGN IN' })).toBeTruthy()
    expect(screen.getByLabelText('EMAIL *').getAttribute('type')).toBe('email')
    expect(screen.getByLabelText('EMAIL *').className).toContain('bg-[#e8f0fe]')
    expect(screen.getByLabelText('PASSWORD *').getAttribute('type')).toBe('password')
    expect(screen.getByLabelText('PASSWORD *').className).toContain('bg-[#e8f0fe]')
    expect(screen.getByRole('link', { name: 'Forgot Password?' }).getAttribute('href')).toBe('/forgot-password')
    expect(screen.getByRole('link', { name: 'Sign up now!' }).getAttribute('href')).toBe('/auth/signup')
    expect(screen.getByText('Do not have an account?').parentElement.parentElement.className).toContain('text-center')
  })

  it('toggles password visibility and restores the hidden state', () => {
    renderLogin()
    const password = screen.getByLabelText('PASSWORD *')
    fireEvent.click(screen.getByRole('button', { name: 'Toggle password visibility' }))
    expect(password.getAttribute('type')).toBe('text')
    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(password.getAttribute('type')).toBe('password')
    expect(screen.getByRole('button', { name: 'Toggle password visibility' })).toBeTruthy()
  })

  it('submits credentials and navigates to the storefront on success', async () => {
    apiClient.post.mockResolvedValue({ data: { redirectTo: '/' } })
    renderLogin()
    fireEvent.change(screen.getByLabelText('EMAIL *'), { target: { value: 'customer@example.com' } })
    fireEvent.change(screen.getByLabelText('PASSWORD *'), { target: { value: 'correct-horse' } })
    fireEvent.submit(screen.getByRole('button', { name: 'SIGN IN →' }).closest('form'))

    expect(apiClient.post).toHaveBeenCalledWith('/auth/user/signin', { email: 'customer@example.com', password: 'correct-horse' })
    await waitFor(() => expect(screen.getByText('Storefront home')).toBeTruthy())
  })

  it('shows a clear error when credentials are rejected', async () => {
    apiClient.post.mockRejectedValue({ status: 401, code: 'INVALID_CREDENTIALS' })
    renderLogin()
    fireEvent.change(screen.getByLabelText('EMAIL *'), { target: { value: 'customer@example.com' } })
    fireEvent.change(screen.getByLabelText('PASSWORD *'), { target: { value: 'wrong-password' } })
    fireEvent.submit(screen.getByRole('button', { name: 'SIGN IN →' }).closest('form'))

    expect((await screen.findByRole('alert')).textContent).toBe('Invalid email or password.')
  })

  it.each([
    ['MISSING_REQUIRED_FIELDS', 'Please fill in all required fields.'],
    ['INVALID_EMAIL_FORMAT', 'Please enter a valid email address.'],
    ['ACCOUNT_INACTIVE', 'This account is inactive. Please contact support.'],
    ['OTHER_ERROR', 'Sign in failed. Please try again.'],
  ])('shows the mapped message for %s', async (code, message) => {
    apiClient.post.mockRejectedValue({ status: 400, payload: { code } })
    renderLogin()
    fireEvent.change(screen.getByLabelText('EMAIL *'), { target: { value: 'member@example.com' } })
    fireEvent.change(screen.getByLabelText('PASSWORD *'), { target: { value: 'password123' } })
    submitLogin()
    expect((await screen.findByRole('alert')).textContent).toBe(message)
  })

  it('does not create a local session when the sign-in endpoint is unavailable', async () => {
    apiClient.post.mockRejectedValue({ status: 404, code: 'NOT_FOUND' })
    renderLogin()
    fireEvent.change(screen.getByLabelText('EMAIL *'), { target: { value: ' Demo@Example.com ' } })
    fireEvent.change(screen.getByLabelText('PASSWORD *'), { target: { value: 'password123' } })
    submitLogin()
    expect((await screen.findByRole('alert')).textContent).toBe('Sign in failed. Please try again.')
    expect(screen.queryByText('Storefront home')).toBeNull()
  })

  it('accepts only safe internal redirect paths', async () => {
    apiClient.post.mockResolvedValue({ data: { redirectTo: '//example.com' } })
    render(<MemoryRouter initialEntries={['/login']}><Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<p>Storefront home</p>} />
    </Routes></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('EMAIL *'), { target: { value: 'member@example.com' } })
    fireEvent.change(screen.getByLabelText('PASSWORD *'), { target: { value: 'password123' } })
    submitLogin()
    await waitFor(() => expect(screen.getByText('Storefront home')).toBeTruthy())
  })
})

function submitLogin() {
  fireEvent.submit(screen.getByRole('button', { name: /SIGN IN/ }).closest('form'))
}
