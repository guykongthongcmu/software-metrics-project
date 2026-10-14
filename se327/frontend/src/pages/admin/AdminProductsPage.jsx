import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'
import './admin-products.css'

const categoryOrder = { men: 1, women: 2, kids: 3, baby: 4, unisex: 5 }
function unwrap(response) { return response?.data?.data || response?.data || {} }

export default function AdminProductsPage() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [categoryId, setCategoryId] = useState(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ items: [], totalItems: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadProducts(selectedPage = page, searchQuery = query, selectedCategory = categoryId) {
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ page: String(selectedPage), limit: '60', lang: 'EN' })
    if (searchQuery) params.set('search', searchQuery)
    if (selectedCategory) params.set('category', String(selectedCategory))
    try {
      const result = unwrap(await apiClient.get(`/admin/products?${params.toString()}`))
      setData({ ...result, totalItems: result.pagination?.totalItems ?? result.totalItems ?? 0, totalPages: result.pagination?.totalPages ?? result.totalPages ?? 0, items: result.items || [] })
    } catch (requestError) {
      setData({ items: [], totalItems: 0, totalPages: 0 })
      setError(requestError?.message || 'The server encountered an unexpected condition and could not fulfill the request.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    apiClient.get('/admin/categories')
      .then((response) => {
        const result = unwrap(response)
        const rows = (result.categories || []).filter((item) => item.parentCategoryId == null && !String(item.slug || '').startsWith('tag-'))
        rows.sort((left, right) => {
          const leftOrder = categoryOrder[String(left.slug || '').toLowerCase()] || 999
          const rightOrder = categoryOrder[String(right.slug || '').toLowerCase()] || 999
          return leftOrder - rightOrder || String(left.categoryName || '').localeCompare(String(right.categoryName || ''))
        })
        if (active) setCategories(rows)
      })
      .catch(() => { if (active) setCategories([]) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError('')
      const params = new URLSearchParams({ page: String(page), limit: '60', lang: 'EN' })
      if (query) params.set('search', query)
      if (categoryId) params.set('category', String(categoryId))
      try {
        const result = unwrap(await apiClient.get(`/admin/products?${params.toString()}`))
        if (active) setData({ ...result, totalItems: result.pagination?.totalItems ?? result.totalItems ?? 0, totalPages: result.pagination?.totalPages ?? result.totalPages ?? 0, items: result.items || [] })
      } catch (requestError) {
        if (active) {
          setData({ items: [], totalItems: 0, totalPages: 0 })
          setError(requestError?.message || 'The server encountered an unexpected condition and could not fulfill the request.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }, query ? 500 : 0)
    return () => { active = false; window.clearTimeout(timer) }
  }, [page, categoryId, query])

  const pageCount = Number(data.totalPages) || 0
  const pageNumbers = Array.from({ length: pageCount }, (_, index) => index + 1)
  const start = data.totalItems ? (page - 1) * 60 + 1 : 0
  const end = Math.min(page * 60, data.totalItems)

  return (
    <section className="admin-products-page">
      <header className="admin-feature-header"><div><h2>All Products</h2><p>Manage your product catalog</p></div><Link className="admin-feature-button admin-product-create" to="/admin/products/create">＋ Add Item</Link></header>
      <nav aria-label="Product categories" className="admin-product-tabs"><button aria-pressed={categoryId === null} className={categoryId === null ? 'active' : ''} onClick={() => { setCategoryId(null); setPage(1) }} type="button">All</button>{categories.map((category) => <button aria-pressed={categoryId === category.categoryId} className={categoryId === category.categoryId ? 'active' : ''} key={category.categoryId} onClick={() => { setCategoryId(category.categoryId); setPage(1) }} type="button">{category.categoryName}</button>)}</nav>
      <div className="admin-products-toolbar"><label className="admin-product-search"><span aria-hidden="true">⌕</span><input aria-label="Search items" onChange={(event) => { setQuery(event.target.value.trim()); setPage(1) }} placeholder="Search items..." value={query} /></label><span>Showing {start} - {end} of {data.totalItems || 0}</span></div>
      <section className="admin-feature-card admin-products-table-wrap"><div className="admin-orders-table-scroll"><table className="admin-orders-table admin-products-table"><thead><tr><th>Product Name &amp; ID</th><th>Category</th><th>Type</th><th>Engagement (Likes)</th><th>Items Sold</th><th>Remaining Stock</th><th>Price</th></tr></thead><tbody>
        {loading ? <tr><td colSpan={7}><p role="status">Synchronizing with catalog...</p></td></tr> : error ? <tr><td colSpan={7}><div className="admin-product-error" role="alert"><strong>Communication failure with Catalog Service</strong><p>{error}</p><button className="admin-feature-button" onClick={() => { void loadProducts().catch(() => {}) }} type="button">Retry Connection</button></div></td></tr> : data.items.length ? data.items.map((product) => {
          const stock = Number(product.totalStock) || 0
          const stockLabel = stock === 0 ? 'Out of Stock' : stock < 10 ? 'Low Stock' : 'In Stock'
          return <tr className="admin-product-row" key={product.productId} onClick={() => navigate(`/admin/products/edit/${product.productId}`)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') navigate(`/admin/products/edit/${product.productId}`) }} tabIndex={0}><td><strong>{product.name}</strong><small>#{product.productId}</small></td><td><span className="admin-product-category">{product.rootCategoryName || product.primaryCategoryName || 'General'}</span></td><td>{product.productType || 'N/A'}</td><td>♡ -</td><td>▱ -</td><td><span className={`admin-stock-badge ${stock === 0 ? 'out' : stock < 10 ? 'low' : 'in'}`}>{stockLabel} ({stock})</span></td><td className="admin-product-price">${product.priceFrom ?? '—'}</td></tr>
        }) : <tr><td colSpan={7}><p>No products match your current filters.</p></td></tr>}
      </tbody></table></div></section>
      {pageCount > 1 && <nav aria-label="Product pages" className="admin-product-pagination">{pageNumbers.map((number) => <button aria-current={page === number ? 'page' : undefined} className={page === number ? 'active' : ''} key={number} onClick={() => setPage(number)} type="button">{number}</button>)}</nav>}
    </section>
  )
}
