import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import SignupDatePicker from '../../pages/account/SignupDatePicker.jsx'

afterEach(cleanup)

function ControlledDatePicker({ initialValue = '' }) {
  const [value, setValue] = useState(initialValue)
  return <div>
    <SignupDatePicker value={value} onChange={setValue} />
    <button type="button">Outside</button>
  </div>
}

describe('SignupDatePicker', () => {
  it('moves between months and years, selecting a valid date', () => {
    render(<ControlledDatePicker initialValue="15/01/2000" />)
    fireEvent.click(screen.getByRole('button', { name: 'Open date of birth calendar' }))
    expect(screen.getByLabelText('Month').value).toBe('0')
    expect(screen.getByLabelText('Year').value).toBe('2000')

    fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
    expect(screen.getByLabelText('Month').value).toBe('1')
    fireEvent.change(screen.getByLabelText('Month'), { target: { value: '2' } })
    expect(screen.getByLabelText('Month').value).toBe('2')
    fireEvent.change(screen.getByLabelText('Year'), { target: { value: '2001' } })
    fireEvent.click(screen.getByRole('button', { name: 'Decrease year' }))
    expect(screen.getByLabelText('Year').value).toBe('2000')
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(screen.getByLabelText('Month').value).toBe('1')

    const selectedDate = screen.getByRole('button', { name: 'February 15, 2000' })
    expect(selectedDate.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(selectedDate)
    expect(screen.getByPlaceholderText('DD/MM/YYYY').value).toBe('15/02/2000')
    expect(screen.queryByRole('dialog', { name: 'Date of birth calendar' })).toBeNull()
  })

  it('opens from an empty or invalid text value and closes on Escape or outside pointer', () => {
    render(<ControlledDatePicker />)
    const input = screen.getByPlaceholderText('DD/MM/YYYY')
    fireEvent.change(input, { target: { value: 'not a date' } })
    fireEvent.focus(input)
    expect(screen.getByRole('dialog', { name: 'Date of birth calendar' })).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Enter' })
    fireEvent.pointerDown(input)
    expect(screen.getByRole('dialog', { name: 'Date of birth calendar' })).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Date of birth calendar' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Open date of birth calendar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open date of birth calendar' }))
    expect(screen.queryByRole('dialog', { name: 'Date of birth calendar' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Open date of birth calendar' }))
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }))
    expect(screen.queryByRole('dialog', { name: 'Date of birth calendar' })).toBeNull()
  })

  it('reopens at a manually entered valid date and blocks future dates', () => {
    render(<ControlledDatePicker />)
    const input = screen.getByPlaceholderText('DD/MM/YYYY')
    const pastDate = new Date()
    pastDate.setFullYear(pastDate.getFullYear() - 1)
    const formatted = `${String(pastDate.getDate()).padStart(2, '0')}/${String(pastDate.getMonth() + 1).padStart(2, '0')}/${pastDate.getFullYear()}`
    fireEvent.change(input, { target: { value: formatted } })
    fireEvent.click(screen.getByRole('button', { name: 'Open date of birth calendar' }))
    expect(screen.getByLabelText('Year').value).toBe(String(pastDate.getFullYear()))
    expect(screen.getByLabelText('Month').value).toBe(String(pastDate.getMonth()))
    fireEvent.change(screen.getByLabelText('Year'), { target: { value: String(new Date().getFullYear()) } })
    fireEvent.change(screen.getByLabelText('Month'), { target: { value: String(new Date().getMonth()) } })

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const futureLabel = new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', year: 'numeric' }).format(tomorrow)
    expect(screen.getByRole('button', { name: futureLabel }).disabled).toBe(true)
  })
})
