import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'
import './admin-products.css'

const categoryOrder = { men: 1, women: 2, kids: 3, baby: 4, unisex: 5 }
function unwrap(response) { return response?.data?.data || response?.data || {} }
function stockPresentation(stock) {
  if (stock === 0) return { label: 'Out of Stock', className: 'out' }
  if (stock < 10) return { label: 'Low Stock', className: 'low' }
  return { label: 'In Stock', className: 'in' }
}
function ProductRow({ product, navigate }) {
  const stock = Number(product.totalStock) || 0
  const stockStatus = stockPresentation(stock)
  const warningStock = stock <= 10 ? 'warning' : ''
  const editProduct = () => navigate(`/admin/products/edit/${product.productId}`)

  return (
    <tr className="admin-product-row" key={product.productId} onClick={editProduct} onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        editProduct()
      }
    }} tabIndex={0}>
      <td><strong>{product.name}</strong><small>#{product.productId}</small></td>
      <td><span className="admin-product-category">{product.rootCategoryName || product.primaryCategoryName || 'General'}</span></td>
      <td>{product.productType || 'N/A'}</td>
      <td><span className="admin-product-metric"><svg aria-hidden="true" className="admin-product-table-icon" viewBox="0 0 16 16"><path d="M8 14s-6-3.5-6-8a3.5 3.5 0 0 1 6-2.5A3.5 3.5 0 0 1 14 6c0 4.5-6 8-6 8Z" /></svg><span>-</span></span></td>
      <td><span className="admin-product-metric"><svg aria-hidden="true" className="admin-product-table-icon" viewBox="0 0 16 16"><path d="M2.5 5.5h11l.75 9h-12.5l.75-9Z" /><path d="M5.5 5.5V3.75a2.5 2.5 0 0 1 5 0V5.5" /></svg><span>-</span></span></td>
      <td><span className={`admin-stock-badge ${stockStatus.className} ${warningStock}`}>{stockStatus.label} ({stock})</span></td>
      <td className="admin-product-price">${product.priceFrom}</td>
    </tr>
  )
}

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
    if (searchQuery.trim()) params.set('search', searchQuery.trim())
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
      if (query.trim()) params.set('search', query.trim())
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
  let productRows
  if (loading) {
    productRows = <tr><td colSpan={7}><output>Synchronizing with catalog...</output></td></tr>
  } else if (error) {
    productRows = <tr><td colSpan={7}><div className="admin-product-error" role="alert"><strong>Communication failure with Catalog Service (Port 3000)</strong><p>{error}</p><button className="admin-feature-button" onClick={() => { void loadProducts() }} type="button">Retry Connection</button></div></td></tr>
  } else if (data.items.length > 0) {
    productRows = data.items.map((product) => <ProductRow key={product.productId} navigate={navigate} product={product} />)
  } else {
    productRows = <tr><td colSpan={7}><p>No products match your current filters.</p></td></tr>
  }

  return (
    <section className="admin-products-page">
      <header className="admin-feature-header"><div><h2>All Products</h2><p>Manage your product catalog</p></div><div className="admin-product-header-actions"><Link className="admin-feature-button admin-product-create" to="/admin/products/create"><span aria-hidden="true">＋</span> Add Item</Link></div></header>
      <nav aria-label="Product categories" className="admin-product-tabs"><button aria-pressed={categoryId === null} className={categoryId === null ? 'active' : ''} onClick={() => { setCategoryId(null); setPage(1) }} type="button">All</button>{categories.map((category) => <button aria-pressed={categoryId === category.categoryId} className={categoryId === category.categoryId ? 'active' : ''} key={category.categoryId} onClick={() => { setCategoryId(category.categoryId); setPage(1) }} type="button">{category.categoryName}</button>)}</nav>
      <div className="admin-products-toolbar"><label className="admin-product-search"><svg aria-hidden="true" viewBox="0 0 16 16"><circle cx="6.5" cy="6.5" r="4.5" /><path d="m10 10 4.5 4.5" /></svg><input aria-label="Search items" onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="Search items..." value={query} /></label><span>Showing {start} - {end} of {data.totalItems || 0}</span></div>
      <section className="admin-feature-card admin-products-table-wrap"><div className="admin-orders-table-scroll"><table className="admin-orders-table admin-products-table"><thead><tr><th>Product Name &amp; ID</th><th>Category</th><th>Type</th><th>Engagement (Likes)</th><th>Items Sold</th><th>Remaining Stock</th><th>Price</th></tr></thead><tbody>{productRows}</tbody></table></div></section>
      {pageCount > 1 && <nav aria-label="Product pages" className="admin-product-pagination">{pageNumbers.map((number) => <button aria-current={page === number ? 'page' : undefined} className={page === number ? 'active' : ''} key={number} onClick={() => setPage(number)} type="button">{number}</button>)}</nav>}
    </section>
  )
}
