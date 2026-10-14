import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { ApiError, apiClient } from '../../lib/apiClient.js'
import CheckoutPage from '../../pages/webstore/CheckoutPage.jsx'
import CheckoutSuccessPage from '../../pages/webstore/CheckoutSuccessPage.jsx'

vi.mock('../../lib/apiClient.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, apiClient: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }
})

const address = {
  fullName: 'Ada Lovelace',
  phoneNumber: '0812345678',
  addressLine1: '12 Analytical Engine Road',
  addressLine2: 'Floor 2',
  district: 'Watthana',
  province: 'Bangkok',
  postalCode: '10110',
  country: 'Thailand',
}
const item = {
  itemId: 1,
  productId: 59,
  name: 'Premium Linen Shirt',
  image: '/shirt.jpg',
  color: 'Mocha',
  size: 'M',
  quantityCartItem: 2,
  lineTotal: 107,
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}</output>
}

function renderCheckout() {
  return render(
    <MemoryRouter initialEntries={['/checkout']}>
      <LocationProbe />
      <Routes>
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
        <Route path="/login" element={<p>Login page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

function setupApi({
  cart = { data: { items: [item], cartSummary: { subtotal: 107, totalItems: 2 } } },
  savedAddress = { data: { address } },
} = {}) {
  apiClient.get.mockImplementation((path) => {
    const result = path.includes('/checkout/address') ? savedAddress : cart
    return result instanceof Error ? Promise.reject(result) : Promise.resolve(result)
  })
  apiClient.put.mockResolvedValue({ data: { address } })
  apiClient.post.mockResolvedValue({ data: { orderId: 456 } })
}

describe('CheckoutPage', () => {
  beforeEach(() => {
    apiClient.get.mockReset()
    apiClient.put.mockReset()
    apiClient.post.mockReset()
  })

  afterEach(() => cleanup())

  it('prefills the saved address and shows the cart summary with VAT included', async () => {
    setupApi()
    renderCheckout()

    expect(await screen.findByRole('heading', { name: 'Checkout' })).toBeTruthy()
    expect(screen.getByLabelText('First Name').value).toBe('Ada')
    expect(screen.getByLabelText('Last Name').value).toBe('Lovelace')
    expect(screen.getByLabelText('Address Line 2').value).toBe('Floor 2')
    expect(screen.getByLabelText('Country').value).toBe('Thailand')
    expect(screen.getAllByText('Premium Linen Shirt')).toHaveLength(2)
    expect(screen.getAllByText('$107.00')).toHaveLength(6)
    expect(screen.getAllByText('$7.00')).toHaveLength(2)
    expect(screen.getAllByText('VAT Included (7%)')).toHaveLength(2)
    expect(screen.getAllByText((_, node) => node?.textContent === 'Color: MochaSize: MQty: 2')).toHaveLength(2)
    expect(screen.getByText(/Terms and Conditions/).closest('a')).toBeNull()
    expect(screen.getByRole('button', { name: 'Complete' }).disabled).toBe(false)
  })

  it('uses blank address defaults and disables completion when the cart is empty', async () => {
    setupApi({ cart: { data: { items: [], cartSummary: { subtotal: 0, totalItems: 0 } } }, savedAddress: { data: { address: null } } })
    renderCheckout()

    expect((await screen.findByLabelText('First Name')).value).toBe('')
    expect(screen.getByLabelText('Country').value).toBe('Thailand')
    expect(screen.getAllByText('Your cart is empty.')).toHaveLength(2)
    expect(screen.getAllByText('$0.00')).toHaveLength(6)
    expect(screen.getByRole('button', { name: 'Complete' }).disabled).toBe(true)
    fireEvent.submit(document.querySelector('form'))
    expect((await screen.findByRole('alert')).textContent).toBe('Your cart is empty')
  })

  it('saves the address and purchases for a customer with no saved address', async () => {
    setupApi({ savedAddress: { data: { address: null } } })
    renderCheckout()
    await screen.findByRole('heading', { name: 'Checkout' })
    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'Grace' } })
    fireEvent.change(screen.getByLabelText('Address'), { target: { value: '9 Compiler Lane' } })
    fireEvent.click(screen.getByRole('button', { name: 'Complete' }))

    expect(await screen.findByRole('heading', { name: /Thank you for/ })).toBeTruthy()
    expect(apiClient.put).toHaveBeenCalledTimes(1)
    expect(apiClient.post).toHaveBeenCalledWith('/client/checkout/purchase', {}, { redirectOn401: false })
    expect(apiClient.put.mock.invocationCallOrder[0]).toBeLessThan(apiClient.post.mock.invocationCallOrder[0])
  })

  it('renders fallback values for incomplete cart item data', async () => {
    const incompleteItem = {
      ...item,
      itemId: undefined,
      name: '',
      image: '',
      color: '',
      size: '',
      price: 0,
      quantityCartItem: 0,
      lineTotal: undefined,
    }
    setupApi({ cart: { data: { items: [incompleteItem], cartSummary: null } } })
    renderCheckout()

    expect(await screen.findAllByAltText('Product')).toHaveLength(2)
    expect(screen.getAllByText((_, node) => node?.textContent === 'Color: —Size: —Qty: 0')).toHaveLength(4)
    expect(screen.getAllByText('$0.00')).toHaveLength(8)
    expect(screen.getByLabelText('First Name').value).toBe('Ada')
  })

  it('shows cart loading errors inline', async () => {
    setupApi({ cart: new ApiError('Could not load checkout cart', { status: 503 }) })
    renderCheckout()
    expect((await screen.findByRole('alert')).textContent).toBe('Could not load checkout cart')
    expect(screen.getByRole('button', { name: 'Complete' }).disabled).toBe(true)
  })

  it('redirects to login when the cart or saved-address lookup returns unauthorized', async () => {
    setupApi({ cart: new ApiError('Unauthorized', { status: 401 }) })
    renderCheckout()
    expect(await screen.findByText('Login page')).toBeTruthy()

    cleanup()
    setupApi({ savedAddress: new ApiError('Unauthorized', { status: 401 }) })
    renderCheckout()
    expect(await screen.findByText('Login page')).toBeTruthy()
  })

  it('keeps checkout available if loading a saved address fails for a non-auth reason', async () => {
    setupApi({ savedAddress: new ApiError('Address unavailable', { status: 503 }) })
    renderCheckout()
    expect(await screen.findByRole('heading', { name: 'Checkout' })).toBeTruthy()
    expect(screen.getByLabelText('First Name').value).toBe('')
    expect(screen.getByRole('button', { name: 'Complete' }).disabled).toBe(false)
  })

  it('ignores pending checkout lookups after the page unmounts', async () => {
    const pendingRequests = []
    apiClient.get.mockImplementation((path) => new Promise((resolve) => {
      pendingRequests.push({ path, resolve })
    }))
    const view = renderCheckout()
    view.unmount()
    pendingRequests.forEach(({ path, resolve }) => resolve(path.includes('/checkout/address')
      ? { data: { address } }
      : { data: { items: [item], cartSummary: { subtotal: 107 } } }))
    await Promise.all(apiClient.get.mock.results.map(({ value }) => value))
    expect(screen.queryByRole('heading', { name: 'Checkout' })).toBeNull()
  })

  it('shows a connection error if a checkout lookup throws before returning a promise', async () => {
    apiClient.get.mockImplementation(() => { throw new Error('network down') })
    renderCheckout()
    expect((await screen.findByRole('alert')).textContent).toBe('Could not connect to server')
  })

  it('saves the shipping address before purchase and navigates to the success page', async () => {
    setupApi()
    renderCheckout()
    await screen.findByRole('heading', { name: 'Checkout' })
    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: '  Grace ' } })
    fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: ' Hopper  ' } })
    fireEvent.change(screen.getByLabelText('Address'), { target: { value: '  9 Compiler Lane  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Complete' }))

    expect(await screen.findByRole('heading', { name: /Thank you for/ })).toBeTruthy()
    expect(screen.getByText('#456')).toBeTruthy()
    expect(apiClient.put).toHaveBeenCalledWith('/client/checkout/address', {
      ...address,
      fullName: 'Grace Hopper',
      addressLine1: '9 Compiler Lane',
    }, { redirectOn401: false })
    expect(apiClient.post).toHaveBeenCalledWith('/client/checkout/purchase', {}, { redirectOn401: false })
    expect(apiClient.put.mock.invocationCallOrder[0]).toBeLessThan(apiClient.post.mock.invocationCallOrder[0])
  })

  it('shows address validation errors inline and preserves the typed values without purchasing', async () => {
    setupApi()
    apiClient.put.mockRejectedValue(new ApiError('address payload is invalid', {
      status: 400,
      payload: { details: { fullName: 'fullName is required', postalCode: 'postalCode format is invalid' } },
    }))
    renderCheckout()
    await screen.findByRole('heading', { name: 'Checkout' })
    fireEvent.change(screen.getByLabelText('Postal Code'), { target: { value: '10@10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Complete' }))

    expect((await screen.findByRole('alert')).textContent).toBe('address payload is invalid')
    expect(screen.getByText('fullName is required')).toBeTruthy()
    expect(screen.getByText('postalCode format is invalid')).toBeTruthy()
    expect(screen.getByLabelText('Postal Code').getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByLabelText('Postal Code').value).toBe('10@10')
    expect(apiClient.post).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Postal Code'), { target: { value: '10110' } })
    expect(screen.queryByText('postalCode format is invalid')).toBeNull()
    expect(screen.getByLabelText('Postal Code').getAttribute('aria-invalid')).toBe('false')
  })

  it('shows field validation details that do not refer to the full name', async () => {
    setupApi()
    apiClient.put.mockRejectedValue(new ApiError('address payload is invalid', {
      status: 400,
      payload: { details: { district: 'district is required' } },
    }))
    renderCheckout()
    await screen.findByRole('heading', { name: 'Checkout' })
    fireEvent.click(screen.getByRole('button', { name: 'Complete' }))
    expect(await screen.findByText('district is required')).toBeTruthy()
    expect(screen.getByLabelText('District').getAttribute('aria-invalid')).toBe('true')
  })

  it('shows purchase stock errors inline and keeps the address in the form', async () => {
    setupApi()
    apiClient.post.mockRejectedValue(new ApiError('requested quantity exceeds available stock', { status: 409 }))
    renderCheckout()
    await screen.findByRole('heading', { name: 'Checkout' })
    fireEvent.change(screen.getByLabelText('District'), { target: { value: 'Sathorn' } })
    fireEvent.click(screen.getByRole('button', { name: 'Complete' }))

    expect((await screen.findByRole('alert')).textContent).toBe('requested quantity exceeds available stock')
    expect(screen.getByLabelText('District').value).toBe('Sathorn')
    expect(apiClient.put).toHaveBeenCalledOnce()
    expect(screen.getByTestId('location').textContent).toBe('/checkout')
  })

  it('explains a missing checkout address returned by the purchase API and keeps entered values', async () => {
    setupApi()
    apiClient.post.mockRejectedValue(new ApiError('Shipping address required', { status: 400, code: 'CHECKOUT_ADDRESS_REQUIRED' }))
    renderCheckout()
    await screen.findByRole('heading', { name: 'Checkout' })
    fireEvent.change(screen.getByLabelText('District'), { target: { value: 'Sathorn' } })
    fireEvent.click(screen.getByRole('button', { name: 'Complete' }))

    expect((await screen.findByRole('alert')).textContent).toBe('Please save a default shipping address to your account before placing your order.')
    expect(screen.getByLabelText('District').value).toBe('Sathorn')
    expect(apiClient.post).toHaveBeenCalledWith('/client/checkout/purchase', {}, { redirectOn401: false })
  })

  it('reports a generic connection error when checkout requests fail unexpectedly', async () => {
    setupApi()
    apiClient.post.mockRejectedValue(new Error('network down'))
    renderCheckout()
    await screen.findByRole('heading', { name: 'Checkout' })
    fireEvent.click(screen.getByRole('button', { name: 'Complete' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Could not connect to server')
  })

  it('redirects to login when checkout APIs report an expired session', async () => {
    setupApi()
    apiClient.put.mockRejectedValue(new ApiError('Unauthorized', { status: 401 }))
    renderCheckout()
    await screen.findByRole('heading', { name: 'Checkout' })
    fireEvent.click(screen.getByRole('button', { name: 'Complete' }))
    expect(await screen.findByText('Login page')).toBeTruthy()
    expect(apiClient.post).not.toHaveBeenCalled()
  })

  it('shows the legacy order confirmation and profile/store links when visited directly', () => {
    render(
      <MemoryRouter initialEntries={['/checkout/success']}>
        <Routes><Route path="/checkout/success" element={<CheckoutSuccessPage />} /></Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText('Order Confirmed')).toBeTruthy()
    expect(screen.getByText('#—')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Continue Shopping' }).getAttribute('href')).toBe('/')
    expect(screen.getByRole('link', { name: 'View My Profile' }).getAttribute('href')).toBe('/account/profile')
  })
})
