import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'
import SignupConfirmPage from '../../pages/account/SignupConfirmPage.jsx'
import SignupInfoPage from '../../pages/account/SignupInfoPage.jsx'

vi.mock('../../lib/apiClient.js', () => ({ apiClient: { post: vi.fn() } }))

afterEach(() => { cleanup() })
beforeEach(() => apiClient.post.mockReset())

function renderInfo() {
  return render(<MemoryRouter initialEntries={['/auth/signup-info?email=member%40example.com']}><Routes>
    <Route path="/auth/signup-info" element={<SignupInfoPage />} />
    <Route path="/auth/signup-confirm" element={<SignupConfirmPage />} />
  </Routes></MemoryRouter>)
}

function fillValidForm() {
  fireEvent.change(screen.getByLabelText('NAME*'), { target: { value: 'Mina' } })
  fireEvent.change(screen.getByLabelText('SURNAME*'), { target: { value: 'Example' } })
  fireEvent.change(screen.getByLabelText('DATE OF BIRTH*'), { target: { value: '12/03/2000' } })
  fireEvent.change(screen.getByLabelText('PASSWORD*'), { target: { value: 'password123' } })
  fireEvent.change(screen.getByLabelText('PASSWORD CONFIRMATION*'), { target: { value: 'password123' } })
  fireEvent.change(screen.getByLabelText('MOBILE NUMBER*'), { target: { value: '081-234-5678' } })
  fireEvent.click(screen.getByLabelText(/I agree to the/))
}

describe('SignupInfoPage', () => {
  it('renders the information form with the email and second progress step', () => {
    renderInfo()

    expect(screen.getByRole('heading', { name: 'Become our member' })).toBeTruthy()
    expect(screen.getByLabelText('Sign up progress').querySelector('[aria-current="step"]').textContent).toContain('INFO')
    expect(document.querySelector('input[name="email"]').value).toBe('member@example.com')
    expect(screen.getByLabelText('Country code').value).toBe('+66')
    expect(screen.getByRole('button', { name: 'CONTINUE' }).disabled).toBe(true)
    expect(screen.getByRole('link', { name: 'Log in' }).getAttribute('href')).toBe('/login')
  })

  it('opens the legacy style date calendar and fills the date in DD/MM/YYYY format', () => {
    renderInfo()
    const dateInput = screen.getByLabelText('DATE OF BIRTH*')
    fireEvent.click(screen.getByRole('button', { name: 'Open date of birth calendar' }))
    expect(screen.getByRole('dialog', { name: 'Date of birth calendar' })).toBeTruthy()
    expect(screen.getByText(new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date()))).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Previous month' })).toBeTruthy()
    const yearPicker = screen.getByLabelText('Year')
    fireEvent.change(yearPicker, { target: { value: '2000' } })
    expect(yearPicker.value).toBe('2000')
    fireEvent.click(screen.getByRole('button', { name: 'Increase year' }))
    expect(yearPicker.value).toBe('2001')
    fireEvent.change(yearPicker, { target: { value: String(new Date().getFullYear()) } })

    const today = new Date()
    const todayLabel = new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', year: 'numeric' }).format(today)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowLabel = new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', year: 'numeric' }).format(tomorrow)
    expect(screen.getByRole('button', { name: tomorrowLabel }).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: todayLabel }))
    expect(dateInput.value).toBe(`${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`)
    expect(screen.queryByRole('dialog', { name: 'Date of birth calendar' })).toBeNull()
  })

  it('shows and hides both password fields', () => {
    renderInfo()
    const password = screen.getByLabelText('PASSWORD*')
    const confirmation = screen.getByLabelText('PASSWORD CONFIRMATION*')

    fireEvent.click(screen.getByRole('button', { name: 'Show password' }))
    expect(password.type).toBe('text')
    fireEvent.click(screen.getByRole('button', { name: 'Show password confirmation' }))
    expect(confirmation.type).toBe('text')
    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }))
    fireEvent.click(screen.getByRole('button', { name: 'Hide password confirmation' }))
    expect(password.type).toBe('password')
    expect(confirmation.type).toBe('password')
  })

  it('validates password matching, numeric mobile input, and terms before enabling continue', () => {
    renderInfo()
    fireEvent.change(screen.getByLabelText('PASSWORD*'), { target: { value: 'one' } })
    fireEvent.change(screen.getByLabelText('PASSWORD CONFIRMATION*'), { target: { value: 'two' } })
    fireEvent.change(screen.getByLabelText('MOBILE NUMBER*'), { target: { value: '12abc' } })

    expect(screen.getByText('Passwords do not match').className).toContain('visible')
    expect(screen.getByText('Please enter only numbers').className).toContain('visible')
    expect(screen.getByRole('button', { name: 'CONTINUE' }).disabled).toBe(true)

    fireEvent.change(screen.getByLabelText('PASSWORD CONFIRMATION*'), { target: { value: 'one' } })
    fireEvent.change(screen.getByLabelText('MOBILE NUMBER*'), { target: { value: '123 456-7890' } })
    fireEvent.click(screen.getByLabelText(/I agree to the/))
    expect(screen.getByRole('button', { name: 'CONTINUE' }).disabled).toBe(false)
  })

  it('submits registration details to the backend before showing the confirmation step', async () => {
    apiClient.post.mockResolvedValue({ data: { email: 'member@example.com', verification_email_sent: true } })
    renderInfo()
    fillValidForm()
    expect(screen.getByLabelText('DATE OF BIRTH*').value).toBe('12/03/2000')
    expect(screen.getByRole('button', { name: 'CONTINUE' }).disabled).toBe(false)
    fireEvent.submit(screen.getByRole('button', { name: 'CONTINUE' }).closest('form'))

    expect(apiClient.post).toHaveBeenCalledWith('/auth/signup', {
      email: 'member@example.com',
      password: 'password123',
      first_name: 'Mina',
      last_name: 'Example',
      DOB: '2000-03-12',
      phone_number: '+66812345678',
    })
    await waitFor(() => expect(screen.getByRole('heading', { name: /We already sent you/ })).toBeTruthy())
    expect(screen.getByLabelText('Sign up progress').querySelector('[aria-current="step"]').textContent).toContain('CONFIRM')
  })

})

describe('SignupConfirmPage', () => {
  it('renders the final progress step, verification notice, and login link', () => {
    render(<MemoryRouter><SignupConfirmPage /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: /We already sent you/ })).toBeTruthy()
    expect(screen.getByLabelText('Sign up progress').querySelector('[aria-current="step"]').textContent).toContain('CONFIRM')
    expect(screen.getByRole('link', { name: 'Log in' }).getAttribute('href')).toBe('/login')
    expect(document.querySelector('.signup-mail-icon svg')).toBeTruthy()
  })
})
