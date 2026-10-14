import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'
import './admin-orders.css'

function unwrap(response) {
  return response?.data?.data || response?.data || {}
}

function money(value) {
  return `$${(Number(value) || 0).toFixed(2)}`
}

function formatDate(value) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  const pad = (part) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function toast(title, message, type = 'success') {
  window.dispatchEvent(new CustomEvent('admin:toast', { detail: { title, message, type } }))
}

export default function AdminOrdersPage() {
  const [page, setPage] = useState(1)
  /** @type {[any, (value: any) => void]} */
  const [orders, setOrders] = useState({ items: [], page: 1, totalItems: 0, totalPages: 0 })
  const [growth, setGrowth] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadPage = useCallback(async (selectedPage) => {
    setLoading(true)
    setError('')
    try {
      const [ordersResponse, summaryResponse] = await Promise.all([
        apiClient.get(`/admin/orders?page=${selectedPage}&limit=7&status=PURCHASED`),
        apiClient.get('/admin/dashboard/summary?period=7d'),
      ])
      setOrders(unwrap(ordersResponse))
      setGrowth(Number(unwrap(summaryResponse)?.orders?.growth) || 0)
    } catch (requestError) {
      setError(requestError?.message || 'Failed to load orders')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    Promise.all([
      apiClient.get(`/admin/orders?page=${page}&limit=7&status=PURCHASED`),
      apiClient.get('/admin/dashboard/summary?period=7d'),
    ])
      .then(([ordersResponse, summaryResponse]) => {
        if (!active) return
        setOrders(unwrap(ordersResponse))
        setGrowth(Number(unwrap(summaryResponse)?.orders?.growth) || 0)
      })
      .catch((requestError) => {
        if (active) setError(requestError?.message || 'Failed to load orders')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [page])

  async function deleteOrder(orderId) {
    if (!window.confirm(`Delete order #${orderId}? This cannot be undone.`)) return
    try {
      await apiClient.delete(`/admin/orders/${orderId}`)
      toast('Deleted', `Order #${orderId} deleted successfully.`)
      const nextPage = orders.items.length === 1 && page > 1 ? page - 1 : page
      if (nextPage === page) await loadPage(nextPage)
      else setPage(nextPage)
    } catch (requestError) {
      toast('Delete Failed', requestError?.message || 'Could not delete order', 'error')
    }
  }

  const pages = Array.from({ length: Math.min(5, Math.max(orders.totalPages || 0, 0)) }, (_, index) => Math.max(1, Math.min(orders.totalPages - 4, page - 2)) + index)

  return (
    <section className="admin-orders-page">
      <header className="admin-feature-header"><div><h2>Orders Management</h2><p>Manage and track all customer orders efficiently.</p></div></header>
      <article className="admin-feature-card admin-orders-stat"><span className="admin-kpi-icon golden" aria-hidden="true">▣</span><span className={`admin-stat-growth ${growth >= 0 ? 'is-positive' : 'is-negative'}`}>{growth >= 0 ? '+' : ''}{growth}%</span><p>Total Orders</p><strong>{Number(orders.totalItems || 0).toLocaleString()}</strong></article>
      <section className="admin-feature-card admin-orders-table-card">
        <header><h3>Recent Orders</h3></header>
        <div className="admin-orders-table-scroll"><table className="admin-orders-table"><thead><tr><th>ORDER ID</th><th>DATE</th><th>USER ID</th><th>STATUS</th><th>TOTAL</th><th>ACTIONS</th></tr></thead>
          <tbody>{loading ? <tr><td colSpan={6}><p role="status">Loading orders...</p></td></tr> : error ? <tr><td colSpan={6}><p role="alert">{error}</p><button className="admin-feature-button" onClick={() => { void loadPage(page).catch(() => {}) }} type="button">Retry</button></td></tr> : orders.items?.length ? orders.items.map((order) => <tr key={order.orderId}><td><Link to={`/admin/orders/${order.orderId}`}>ORD-{order.orderId}</Link></td><td>{formatDate(order.createdAt)}</td><td>User #{order.userId}</td><td><span className={`admin-order-status status-${String(order.status || '').toLowerCase()}`}>{order.status}</span></td><td>{money(order.total)}</td><td><div className="admin-order-actions"><Link className="admin-feature-button" to={`/admin/orders/${order.orderId}`}>Manage</Link><button className="admin-order-delete" onClick={() => { void deleteOrder(order.orderId).catch(() => {}) }} type="button">Delete</button></div></td></tr>) : <tr><td colSpan={6}><p>No orders found for this criteria.</p></td></tr>}</tbody>
        </table></div>
        <footer className="admin-orders-pagination"><span>{orders.totalPages > 1 ? `Showing page ${orders.page} of ${orders.totalPages} (${orders.totalItems} total items)` : `Showing ${orders.totalItems || 0} total items`}</span>
          {orders.totalPages > 1 && <nav aria-label="Orders pages"><button aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)} type="button">‹</button>{pages.map((number) => <button aria-current={page === number ? 'page' : undefined} className={page === number ? 'active' : ''} key={number} onClick={() => setPage(number)} type="button">{number}</button>)}<button aria-label="Next page" disabled={page >= orders.totalPages} onClick={() => setPage(page + 1)} type="button">›</button></nav>}
        </footer>
      </section>
    </section>
  )
}
