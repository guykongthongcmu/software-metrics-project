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

  it('submits email and password, refreshes the header, and returns to the storefront', async () => {
    apiClient.post.mockResolvedValue({ status: 'success' })
    const refreshListener = vi.fn()
    window.addEventListener('storefront:refresh-header', refreshListener)
    renderLogin()
    fireEvent.change(screen.getByLabelText('EMAIL *'), { target: { value: 'customer@example.com' } })
    fireEvent.change(screen.getByLabelText('PASSWORD *'), { target: { value: 'correct-horse' } })
    fireEvent.submit(screen.getByRole('button', { name: 'SIGN IN →' }).closest('form'))

    expect(apiClient.post).toHaveBeenCalledWith('/auth/user/signin', { email: 'customer@example.com', password: 'correct-horse' })
    expect(await screen.findByText('Storefront home')).toBeTruthy()
    expect(refreshListener).toHaveBeenCalledTimes(1)
    window.removeEventListener('storefront:refresh-header', refreshListener)
  })

  it.each([
    [{ code: 'INVALID_CREDENTIALS' }, 'Invalid email or password.'],
    [{ payload: { code: 'MISSING_REQUIRED_FIELDS' } }, 'Please fill in all required fields.'],
    [{ code: 'INVALID_EMAIL_FORMAT' }, 'Please enter a valid email address.'],
    [{ status: 500 }, 'Sign in failed. Please try again.'],
    [new Error('network failure'), 'Could not connect to server'],
  ])('shows a useful message for sign-in failures', async (failure, message) => {
    apiClient.post.mockRejectedValue(failure)
    renderLogin()
    fireEvent.change(screen.getByLabelText('EMAIL *'), { target: { value: 'customer@example.com' } })
    fireEvent.change(screen.getByLabelText('PASSWORD *'), { target: { value: 'wrong-password' } })
    fireEvent.submit(screen.getByRole('button', { name: 'SIGN IN →' }).closest('form'))

    expect((await screen.findByRole('alert')).textContent).toBe(message)
    expect(screen.getByLabelText('EMAIL *').value).toBe('customer@example.com')
    expect(screen.getByLabelText('PASSWORD *').value).toBe('wrong-password')
  })

  it('disables the submit button while the request is pending', async () => {
    let finishRequest
    apiClient.post.mockReturnValue(new Promise((resolve) => { finishRequest = resolve }))
    renderLogin()
    fireEvent.change(screen.getByLabelText('EMAIL *'), { target: { value: 'customer@example.com' } })
    fireEvent.change(screen.getByLabelText('PASSWORD *'), { target: { value: 'password' } })
    fireEvent.submit(screen.getByRole('button', { name: 'SIGN IN →' }).closest('form'))

    expect(screen.getByRole('button', { name: 'SIGNING IN…' }).hasAttribute('disabled')).toBe(true)
    finishRequest({})
    await waitFor(() => expect(screen.getByText('Storefront home')).toBeTruthy())
  })
})
