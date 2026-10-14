import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'
import './admin-orders.css'

/** @type {Array<[string, string, string, boolean]>} */
const addressFields = [
  ['fullName', 'Full Name', 'text', true], ['phoneNumber', 'Phone Number', 'tel', true],
  ['addressLine1', 'Address Line 1', 'text', true], ['addressLine2', 'Address Line 2', 'text', false],
  ['district', 'District', 'text', true], ['province', 'Province', 'text', true],
  ['postalCode', 'Postal Code', 'text', true], ['country', 'Country', 'text', true],
]

function unwrap(response) { return response?.data?.data || response?.data || {} }
function money(value) { return `$${(Number(value) || 0).toFixed(2)}` }
function formatDate(value) {
  if (!value) return '--'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('en-US', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function notify(title, message, type = 'success') {
  window.dispatchEvent(new CustomEvent('admin:toast', { detail: { title, message, type } }))
}
function getErrorMessage(error) { return error?.payload?.message || error?.message || 'Request failed' }

export default function AdminOrderDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState(null)
  const [address, setAddress] = useState({})
  const [fieldErrors, setFieldErrors] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function loadOrder() {
    setLoading(true)
    setError('')
    try {
      const payload = unwrap(await apiClient.get(`/admin/orders/${id}`))
      setOrder(payload)
      setAddress(payload.shippingAddressSnapshot || {})
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    apiClient.get(`/admin/orders/${id}`)
      .then((response) => {
        if (!active) return
        const payload = unwrap(response)
        setOrder(payload)
        setAddress(payload.shippingAddressSnapshot || {})
      })
      .catch((requestError) => {
        if (active) setError(getErrorMessage(requestError))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [id])

  async function saveAddress(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setFieldErrors({})
    try {
      const payload = unwrap(await apiClient.patch(`/admin/orders/${id}`, { shippingAddressSnapshot: address }))
      setOrder(payload)
      setAddress(payload.shippingAddressSnapshot || address)
      notify('Success', 'Order address snapshot updated.')
    } catch (requestError) {
      setFieldErrors(requestError?.payload?.details || {})
      notify('Update Failed', getErrorMessage(requestError), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function deleteOrder() {
    if (busy || !window.confirm(`Delete order #${id}? This cannot be undone.`)) return
    setBusy(true)
    try {
      await apiClient.delete(`/admin/orders/${id}`)
      notify('Deleted', `Order #${id} deleted successfully.`)
      await navigate('/admin/orders')
    } catch (requestError) {
      notify('Delete Failed', getErrorMessage(requestError), 'error')
      setBusy(false)
    }
  }

  return (
    <section className="admin-order-detail-page">
      <header className="admin-feature-header"><div><h2>Order #{id}</h2><p>{order ? `Placed on ${formatDate(order.createdAt)}` : loading ? 'Loading order details...' : 'Order details'}</p></div><div className="admin-order-header-actions"><Link className="admin-feature-button" to="/admin/orders">← Back to Orders</Link><button className="admin-order-delete" disabled={busy} onClick={() => { void deleteOrder().catch(() => {}) }} type="button">Delete Order</button></div></header>
      {error && <div className="admin-feature-card admin-order-error"><strong>Failed to load order</strong><p role="alert">{error}</p><button className="admin-feature-button" onClick={() => { void loadOrder().catch(() => {}) }} type="button">Retry</button></div>}
      {loading && <p className="admin-feature-card" role="status">Loading order details...</p>}
      {order && !loading && <div className="admin-order-detail-grid">
        <div className="admin-order-detail-main">
          <article className="admin-feature-card"><header className="admin-order-section-header"><div><h3>Order Items</h3><p>Purchased items captured at checkout time.</p></div><span className={`admin-order-status status-${String(order.status || '').toLowerCase()}`}>{order.status || 'PURCHASED'}</span></header>
            <div className="admin-orders-table-scroll"><table className="admin-orders-table"><thead><tr><th>PRODUCT</th><th>COLOUR</th><th>SIZE</th><th>QTY</th><th>UNIT PRICE</th><th>LINE TOTAL</th></tr></thead><tbody>{order.items?.length ? order.items.map((item) => <tr key={item.orderItemId}><td>{item.snapshotProductName || '--'}</td><td>{item.snapshotColor || '--'}</td><td>{item.snapshotSize || '--'}</td><td>{Number(item.quantity) || 0}</td><td>{money(item.snapshotUnitPrice)}</td><td>{money(item.lineTotal)}</td></tr>) : <tr><td colSpan={6}>No line items found for this order.</td></tr>}</tbody></table></div>
          </article>
          <article className="admin-feature-card"><header><h3>Shipping Snapshot</h3><p>Admin corrections here update the stored order snapshot used for admin records.</p></header><form className="admin-order-address-form" onSubmit={(event) => { void saveAddress(event).catch(() => {}) }}>{addressFields.map(([name, label, type, required]) => <label className={name === 'addressLine1' || name === 'addressLine2' ? 'wide' : ''} key={name}>{label}<input autoComplete="off" maxLength={name === 'fullName' ? 150 : name === 'phoneNumber' ? 30 : name.startsWith('address') ? 255 : name === 'postalCode' ? 20 : name === 'country' ? 100 : 120} name={name} onChange={(event) => setAddress((current) => ({ ...current, [name]: event.target.value }))} required={required} type={type} value={address[name] || ''} />{fieldErrors[name] && <small role="alert">{fieldErrors[name]}</small>}</label>)}<div className="wide actions"><button className="admin-feature-button" disabled={busy} type="submit">{busy ? 'Saving...' : 'Save Address Snapshot'}</button></div></form></article>
        </div>
        <aside className="admin-order-detail-aside"><article className="admin-feature-card"><h3>Customer</h3><dl><dt>Name</dt><dd>{order.customer?.name || '--'}</dd><dt>Email</dt><dd>{order.customer?.email || '--'}</dd><dt>User ID</dt><dd>{order.customer?.userId == null ? '--' : `User #${order.customer.userId}`}</dd></dl></article><article className="admin-feature-card"><h3>Order Summary</h3><dl className="admin-order-summary"><dt>Subtotal</dt><dd>{money(order.subtotal)}</dd><dt>Shipping Fee</dt><dd>{money(order.shippingFee)}</dd><dt>VAT</dt><dd>{money(order.vatAmount)}</dd><dt>Total</dt><dd>{money(order.total)}</dd></dl></article><article className="admin-feature-card"><h3>Metadata</h3><dl><dt>Status</dt><dd>{order.status || '--'}</dd><dt>Created At</dt><dd>{formatDate(order.createdAt)}</dd><dt>Updated At</dt><dd>{formatDate(order.updatedAt)}</dd></dl></article></aside>
      </div>}
    </section>
  )
}
