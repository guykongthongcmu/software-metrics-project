import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'
import AdminCampaignBuilderPage from '../../pages/admin/AdminCampaignBuilderPage.jsx'

vi.mock('../../lib/apiClient.js', () => ({ apiClient: { post: vi.fn() } }))

const validFile = () => new File(['campaign image'], 'campaign.webp', { type: 'image/webp' })

async function renderPage() {
  const view = render(<MemoryRouter><AdminCampaignBuilderPage /></MemoryRouter>)
  await waitFor(() => expect(screen.getByLabelText('Campaign Scheduled Duration')._flatpickr).toBeTruthy())
  return view
}

function fillRequiredFields({ type = 'PERCENTAGE_DISCOUNT', discount = '20' } = {}) {
  fireEvent.change(screen.getByLabelText('Campaign Name'), { target: { value: 'Summer Flash Sale' } })
  fireEvent.change(screen.getByLabelText('Offer Type'), { target: { value: type } })
  if (discount !== '') fireEvent.change(screen.getByLabelText('Discount Value'), { target: { value: discount } })
  setCampaignDates('2026-10-20', '2026-10-31')
  fireEvent.change(screen.getByLabelText('Campaign Cover (Image)'), { target: { files: [validFile()] } })
}

function setCampaignDates(start, end) {
  const picker = screen.getByLabelText('Campaign Scheduled Duration')._flatpickr
  act(() => picker.setDate(end ? [start, end] : [start], true))
}

function submitForm() {
  fireEvent.click(screen.getByRole('button', { name: /Launch Campaign/ }))
}

describe('AdminCampaignBuilderPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:campaign-preview'), revokeObjectURL: vi.fn() })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('renders the legacy builder sections and updates the live campaign preview', async () => {
    await renderPage()
    expect(screen.getByRole('heading', { name: 'Promotional Campaign Builder' })).toBeTruthy()
    expect(screen.getByText('Your Sale Name')).toBeTruthy()
    expect(screen.getByText('Dates will appear here')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Campaign Name'), { target: { value: 'Winter Sale' } })
    fireEvent.change(screen.getByLabelText('Offer Type'), { target: { value: 'FIXED_AMOUNT_DISCOUNT' } })
    fireEvent.change(screen.getByLabelText('Discount Value'), { target: { value: '15' } })
    setCampaignDates('2026-10-20', '2026-10-31')
    expect(screen.getByRole('heading', { name: 'Winter Sale' })).toBeTruthy()
    expect(screen.getByText('$15 OFF')).toBeTruthy()
    expect(screen.getByText('Oct 20 — Oct 31')).toBeTruthy()
  })

  it('validates required fields, discount bounds and date ordering before confirmation', async () => {
    await renderPage()
    submitForm()
    expect(screen.getByRole('alert').textContent).toBe('Enter a campaign name.')
    fillRequiredFields({ discount: '120' })
    submitForm()
    expect(screen.getByRole('alert').textContent).toBe('Percentage discount must be 100 or less.')
    fireEvent.change(screen.getByLabelText('Discount Value'), { target: { value: '20' } })
    setCampaignDates('2026-10-20', '')
    submitForm()
    expect(screen.getByRole('alert').textContent).toBe('Select the campaign start and end dates.')
    setCampaignDates('2026-10-20', '2026-10-31')
    fireEvent.click(screen.getByRole('checkbox', { name: /Web Banner/ }))
    submitForm()
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByRole('dialog').textContent).toContain('Channels')
  })

  it('rejects unsupported and oversized files, and supports image preview removal', async () => {
    await renderPage()
    const input = screen.getByLabelText('Campaign Cover (Image)')
    fireEvent.change(input, { target: { files: [new File(['x'], 'movie.mp4', { type: 'video/mp4' })] } })
    expect(screen.getByRole('alert').textContent).toContain('JPEG, PNG or WebP')
    const large = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' })
    fireEvent.change(input, { target: { files: [large] } })
    expect(screen.getByRole('alert').textContent).toContain('5 MB or smaller')
    fireEvent.change(input, { target: { files: [validFile()] } })
    expect(screen.getByAltText('Campaign banner preview').getAttribute('src')).toBe('blob:campaign-preview')
    fireEvent.click(screen.getByRole('button', { name: 'Remove banner image' }))
    expect(screen.queryByAltText('Campaign banner preview')).toBeNull()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:campaign-preview')
  })

  it('opens the confirmation summary and launches with multipart form data and email result toast', async () => {
    const toastListener = vi.fn()
    window.addEventListener('admin:toast', toastListener)
    apiClient.post.mockResolvedValue({
      message: 'Campaign launched successfully.',
      data: { emailBlast: { enabled: true, totalRecipients: 12, sentCount: 10, failedCount: 2 } },
    })
    await renderPage()
    fillRequiredFields()
    fireEvent.click(screen.getByRole('checkbox', { name: /Email blast/ }))
    submitForm()
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByRole('dialog').textContent).toContain('Summer Flash Sale')
    expect(screen.getByRole('dialog').textContent).toContain('Web Banner, Email blast')
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Launch' }))
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(1))
    const [path, formData] = apiClient.post.mock.calls[0]
    expect(path).toBe('/admin/launch-campaign')
    expect(formData.get('mediaFile').name).toBe('campaign.webp')
    expect(JSON.parse(formData.get('campaignData'))).toEqual({
      name: 'Summer Flash Sale', type: 'PERCENTAGE_DISCOUNT', discountValue: 20,
      startDate: '2026-10-20', endDate: '2026-10-31', channels: { web: true, email: true },
    })
    await waitFor(() => expect(toastListener).toHaveBeenCalled())
    expect(toastListener.mock.calls[0][0].detail.message).toContain('Emails sent: 10 of 12. Failed: 2.')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByLabelText('Campaign Scheduled Duration').value).toBe('')
    window.removeEventListener('admin:toast', toastListener)
  })

  it('clears discount for best seller and reports launch API errors in the confirmation dialog', async () => {
    apiClient.post.mockRejectedValue({ payload: { message: 'No sales yet, so there is no best seller' } })
    await renderPage()
    fillRequiredFields()
    fireEvent.change(screen.getByLabelText('Offer Type'), { target: { value: 'BEST_SELLER' } })
    expect(screen.getByLabelText('Discount Value').value).toBe('')
    setCampaignDates('2026-10-20', '2026-10-31')
    submitForm()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Launch' }))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'No sales yet, so there is no best seller')
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(apiClient.post).toHaveBeenCalledTimes(1)
  })

  it('supports dropping an image and closes the confirmation dialog when going back', async () => {
    const { container } = await renderPage()
    const dropZone = container.querySelector('.campaign-builder-drop-zone')
    fireEvent.dragEnter(dropZone, { dataTransfer: { files: [] } })
    expect(dropZone.className).toContain('is-dragging')
    fireEvent.drop(dropZone, { dataTransfer: { files: [validFile()] } })
    expect(screen.getByAltText('Campaign banner preview')).toBeTruthy()
    fillRequiredFields()
    submitForm()
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('closes the confirmation dialog when the backdrop is clicked', async () => {
    await renderPage()
    fillRequiredFields()
    submitForm()
    const backdrop = screen.getByRole('dialog').parentElement
    fireEvent.mouseDown(backdrop, { target: backdrop })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('closes the confirmation dialog with Escape', async () => {
    await renderPage()
    fillRequiredFields()
    submitForm()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows the launch progress state while the API request is pending', async () => {
    let resolveLaunch
    apiClient.post.mockReturnValue(new Promise((resolve) => { resolveLaunch = resolve }))
    await renderPage()
    fillRequiredFields()
    submitForm()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Launch' }))
    expect(screen.getByText('Launching Campaign...')).toBeTruthy()
    resolveLaunch({ message: 'Campaign launched successfully.', data: { emailBlast: { enabled: false, totalRecipients: 0, sentCount: 0, failedCount: 0 } } })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})
