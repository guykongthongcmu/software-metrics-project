import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, apiClient } from '../../lib/apiClient.js'
import { loginPath } from '../../lib/loginRedirect.js'
import './checkout.css'

const emptyAddress = {
  firstName: '', lastName: '', phoneNumber: '', addressLine1: '', addressLine2: '',
  district: '', province: '', postalCode: '', country: 'Thailand',
}

const addressFields = [
  ['firstName', 'First Name', 'John', 'text'],
  ['lastName', 'Last Name', 'Doe', 'text'],
  ['phoneNumber', 'Phone Number', '0812345678', 'tel'],
  ['addressLine1', 'Address', 'Street name and house number', 'text'],
  ['addressLine2', 'Address Line 2', 'Apartment, building, floor (optional)', 'text'],
  ['district', 'District', 'Watthana', 'text'],
  ['province', 'Province', 'Bangkok', 'text'],
  ['postalCode', 'Postal Code', '10110', 'text'],
  ['country', 'Country', 'Thailand', 'text'],
]

function splitFullName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean)
  return { firstName: parts.shift() || '', lastName: parts.join(' ') }
}

function addressFormValue(address) {
  const name = splitFullName(address?.fullName)
  return {
    ...emptyAddress,
    ...name,
    phoneNumber: address?.phoneNumber || '',
    addressLine1: address?.addressLine1 || '',
    addressLine2: address?.addressLine2 || '',
    district: address?.district || '',
    province: address?.province || '',
    postalCode: address?.postalCode || '',
    country: address?.country || 'Thailand',
  }
}

function getErrorText(error, fallback) {
  return error instanceof ApiError ? error.message : fallback
}

const shippingAddressRequiredMessage = 'Please save a default shipping address to your account before placing your order.'

function getCheckoutErrorText(error) {
  const code = error?.code || error?.payload?.code
  if (code === 'CHECKOUT_ADDRESS_REQUIRED') return shippingAddressRequiredMessage
  return getErrorText(error, 'Could not connect to server')
}

function getAutoComplete(name) {
  if (name === 'firstName') return 'given-name'
  if (name === 'lastName') return 'family-name'
  return undefined
}

function getAddressErrors(error) {
  const details = error?.payload?.details
  if (!details || typeof details !== 'object') return {}
  const fields = { ...details }
  if (fields.fullName) {
    fields.firstName = fields.fullName
    delete fields.fullName
  }
  return fields
}

function CheckoutSummary({ items, subtotal }) {
  const vat = subtotal > 0 ? Number((subtotal * 7 / 107).toFixed(2)) : 0
  return (
    <>
      <p className="ck-summary-title">Order Summary</p>
      <div className="ck-items">
        {items.length ? items.map((item, index) => {
          const quantity = Number(item.quantityCartItem) || 0
          const lineTotal = Number(item.lineTotal ?? Number(item.price || 0) * quantity) || 0
          return (
            <div className="ck-order-item" key={item.itemId || `${item.productId}-${index}`}>
              <img alt={item.name || 'Product'} className="ck-order-img" loading="lazy" src={item.image || '/images/product-placeholder.png'} />
              <div className="ck-order-body">
                <div className="ck-order-name">{item.name}</div>
                <div className="ck-order-meta">Color: {item.color || '—'}<br />Size: {item.size || '—'}<br />Qty: {quantity}</div>
              </div>
              <div className="ck-order-price">${lineTotal.toFixed(2)}</div>
            </div>
          )
        }) : <div className="ck-order-empty">Your cart is empty.</div>}
      </div>
      <div className="ck-totals">
        <div className="ck-totals-row"><span className="ck-totals-label">Subtotal</span><span className="ck-totals-val">${subtotal.toFixed(2)}</span></div>
        <div className="ck-totals-row"><span className="ck-totals-label">Shipping</span><span className="ck-totals-val free">Free</span></div>
        <div className="ck-totals-row"><span className="ck-totals-label">VAT Included (7%)</span><span className="ck-totals-val">${vat.toFixed(2)}</span></div>
        <div className="ck-total-row"><span className="ck-total-label">Total</span><span className="ck-total-amount">${subtotal.toFixed(2)}</span></div>
      </div>
      <div className="ck-secure">
        <div aria-hidden="true" className="ck-secure-icon"><svg fill="none" height="16" stroke="currentColor" viewBox="0 0 24 24" width="16"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" /></svg></div>
        <div><div className="ck-secure-title">Secure Checkout</div><div className="ck-secure-text">Your transaction is secured with industry-standard 256-bit SSL encryption.</div></div>
      </div>
    </>
  )
}

export default function CheckoutPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState(emptyAddress)
  const [items, setItems] = useState([])
  const [subtotal, setSubtotal] = useState(0)
  const [hasSavedAddress, setHasSavedAddress] = useState(false)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [status, setStatus] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  useEffect(() => {
    let active = true
    async function loadCheckout() {
      const [cartResult, addressResult] = await Promise.allSettled([
        apiClient.get('/client/cart?lang=EN', { redirectOn401: false }),
        apiClient.get('/client/checkout/address', { redirectOn401: false }),
      ])
      if (!active) return

      if (cartResult.status === 'fulfilled') {
        const cart = cartResult.value?.data || {}
        setItems(Array.isArray(cart.items) ? cart.items : [])
        setSubtotal(Number(cart.cartSummary?.subtotal) || 0)
      } else if (cartResult.reason instanceof ApiError && cartResult.reason.status === 401) {
        void navigate(loginPath())
      } else {
        setStatus(getErrorText(cartResult.reason, 'Could not load checkout cart'))
      }

      if (addressResult.status === 'fulfilled') {
        const savedAddress = addressResult.value?.data?.address
        setHasSavedAddress(Boolean(savedAddress))
        setForm(addressFormValue(savedAddress))
      } else if (addressResult.reason instanceof ApiError && addressResult.reason.status === 401) {
        void navigate(loginPath())
      }
      setLoading(false)
    }
    loadCheckout().catch(() => {
      if (active) {
        setStatus('Could not connect to server')
        setLoading(false)
      }
    })
    return () => { active = false }
  }, [navigate])

  function updateField(event) {
    const { name, value } = event.currentTarget
    setForm((current) => ({ ...current, [name]: value }))
    setFieldErrors((current) => {
      if (!current[name]) return current
      const next = { ...current }
      delete next[name]
      return next
    })
  }

  async function completeOrder(event) {
    event.preventDefault()
    if (items.length === 0) {
      setStatus('Your cart is empty')
      return
    }
    if (!hasSavedAddress) {
      setStatus(shippingAddressRequiredMessage)
      return
    }
    setStatus('')
    setFieldErrors({})
    setProcessing(true)
    const address = {
      fullName: [form.firstName.trim(), form.lastName.trim()].filter(Boolean).join(' '),
      phoneNumber: form.phoneNumber.trim(),
      addressLine1: form.addressLine1.trim(),
      addressLine2: form.addressLine2.trim(),
      district: form.district.trim(),
      province: form.province.trim(),
      postalCode: form.postalCode.trim(),
      country: form.country.trim(),
    }

    try {
      await apiClient.put('/client/checkout/address', address, { redirectOn401: false })
      const result = await apiClient.post('/client/checkout/purchase', {}, { redirectOn401: false })
      window.dispatchEvent(new CustomEvent('storefront:cart-updated', { detail: { count: 0 } }))
      void navigate('/checkout/success', { state: { orderId: result?.data?.orderId } })
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        void navigate(loginPath())
      } else {
        setStatus(getCheckoutErrorText(requestError))
        setFieldErrors(getAddressErrors(requestError))
      }
    } finally {
      setProcessing(false)
    }
  }

  return (
    <main className="ck-page">
      <div className="ck-mobile-summary"><CheckoutSummary items={items} subtotal={subtotal} /></div>
      <div className="ck-layout">
        <div className="ck-left-column"><form className="ck-left" onSubmit={completeOrder}>
          <h1 className="ck-title">Checkout</h1>
          <div className="ck-step-header"><div className="ck-step-num">1</div><span className="ck-step-title">Shipping Address</span></div>
          <div className="ck-section">
            <div className="ck-form-grid">
              {addressFields.map(([name, label, placeholder, type]) => {
                const spanFull = ['phoneNumber', 'addressLine1', 'addressLine2'].includes(name)
                return <div className={spanFull ? 'ck-field ck-field-full' : 'ck-field'} key={name}>
                  <label className="ck-field-label" htmlFor={`checkout-${name}`}>{label}</label>
                  <input aria-invalid={Boolean(fieldErrors[name])} autoComplete={getAutoComplete(name)} className={`ck-input${fieldErrors[name] ? ' has-error' : ''}`} id={`checkout-${name}`} name={name} onChange={updateField} placeholder={placeholder} type={type} value={form[name]} />
                  {fieldErrors[name] && <span className="ck-field-error">{fieldErrors[name]}</span>}
                </div>
              })}
            </div>
          </div>
          {status && <p className="ck-status is-error" role="alert">{status}</p>}
          {loading && <output className="ck-loading">Loading checkout…</output>}
          <button className="ck-submit-btn" disabled={loading || processing || items.length === 0} type="submit">{processing ? 'Processing...' : 'Complete'}</button>
          <p className="ck-terms">Cash on Delivery (COD) By placing your order, you agree to our Terms and Conditions.</p>
        </form></div>
        <aside aria-label="Order summary" className="ck-desktop-summary"><CheckoutSummary items={items} subtotal={subtotal} /></aside>
      </div>
    </main>
  )
}
