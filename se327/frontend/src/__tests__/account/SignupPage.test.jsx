import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'
import SignupPage from '../../pages/account/SignupPage.jsx'

vi.mock('../../lib/apiClient.js', () => ({ apiClient: { post: vi.fn() } }))

afterEach(cleanup)
beforeEach(() => apiClient.post.mockReset())

function CurrentAddress() {
  const location = useLocation()
  return <p data-testid="address">{location.pathname}{location.search}</p>
}

function renderSignup() {
  return render(<MemoryRouter initialEntries={['/auth/signup']}><Routes>
    <Route path="/auth/signup" element={<SignupPage />} />
    <Route path="/auth/signup-info" element={<CurrentAddress />} />
    <Route path="/login" element={<p>Login page</p>} />
  </Routes></MemoryRouter>)
}

describe('SignupPage', () => {
  it('renders the first registration step with the SE262 content and styles', () => {
    renderSignup()

    expect(screen.getByRole('heading', { name: 'Become our member' })).toBeTruthy()
    expect(screen.getByText('SIGN UP NOW!')).toBeTruthy()
    expect(screen.getByLabelText('Sign up progress').textContent).toContain('EMAIL')
    expect(screen.getByLabelText('Sign up progress').textContent).toContain('INFO')
    expect(screen.getByLabelText('Sign up progress').textContent).toContain('CONFIRM')
    expect(screen.getByLabelText('Email').getAttribute('type')).toBe('email')
    expect(screen.getByLabelText('Email').required).toBe(true)
    expect(screen.getByRole('button', { name: 'NEXT' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Log in' }).getAttribute('href')).toBe('/login')
    expect(document.querySelectorAll('.signup-progress-step.active')).toHaveLength(1)
  })

  it('checks email availability before continuing to the information step', async () => {
    apiClient.post.mockResolvedValue({ data: { email: 'member@example.com' } })
    renderSignup()
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'member@example.com' } })
    fireEvent.submit(screen.getByRole('button', { name: 'NEXT' }).closest('form'))

    expect(apiClient.post).toHaveBeenCalledWith('/auth/check-email', { email: 'member@example.com' })
    await waitFor(() => expect(screen.getByTestId('address').textContent).toBe('/auth/signup-info?email=member%40example.com'))
  })

})
