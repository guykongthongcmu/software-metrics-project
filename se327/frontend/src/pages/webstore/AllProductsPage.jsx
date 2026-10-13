import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'
import ProductCard from './partials/ProductCard.jsx'

const PAGE_SIZE = 8
const API_PAGE_SIZE = 50

function getSort(value) {
  return value === 'newest' ? 'newest' : 'recommended'
}

function getPage(value) {
  const page = Number.parseInt(value || '', 10)
  return Number.isInteger(page) && page > 0 ? page : 1
}

async function fetchProductPages(pathForPage) {
  const firstPayload = await apiClient.get(pathForPage(1), { redirectOn401: false })
  const firstPage = firstPayload?.data
  if (!Array.isArray(firstPage?.products)) throw new Error('Unexpected catalogue response')

  const totalPages = Math.max(1, Number(firstPage.pagination?.totalPages) || 1)
  const remainingPages = await Promise.all(Array.from(
    { length: totalPages - 1 },
    (_, index) => apiClient.get(pathForPage(index + 2), { redirectOn401: false }),
  ))
  const pages = [firstPage, ...remainingPages.map((payload) => payload?.data)]
  if (pages.some((page) => !Array.isArray(page?.products))) throw new Error('Unexpected catalogue response')
  return pages
}

function buildCategoryMap(categories, categoryResults) {
  const categoryByProduct = new Map()
  categoryResults.forEach((result, index) => {
    if (result.status !== 'fulfilled') return
    const fallbackCategory = categories[index]
    const category = result.value[0]?.category || {
      slug: fallbackCategory.slug,
      name: fallbackCategory.categoryName,
    }
    result.value.flatMap((page) => page.products).forEach((product) => {
      if (!categoryByProduct.has(Number(product.productId))) {
        categoryByProduct.set(Number(product.productId), category)
      }
    })
  })
  return categoryByProduct
}

async function loadCatalog() {
  const productPages = await fetchProductPages((page) =>
    `/client/products?page=${page}&limit=${API_PAGE_SIZE}&lang=EN`)
  let categories = []
  try {
    const payload = await apiClient.get('/client/categories?sort=category_name&order=asc', { redirectOn401: false })
    categories = Array.isArray(payload?.data?.categories) ? payload.data.categories : []
  } catch {
    categories = []
  }

  const categoryResults = await Promise.allSettled(categories.map(({ slug }) =>
    fetchProductPages((page) =>
      `/client/products/category/${encodeURIComponent(slug)}?page=${page}&limit=${API_PAGE_SIZE}&sort=newest&lang=EN`)))
  const categoryByProduct = buildCategoryMap(categories, categoryResults)
  const products = productPages.flatMap((page) => page.products).map((product) => ({
    ...product,
    image: product.image || product.imageUrl,
    originalPrice: product.originalPrice ?? product.compareAtPrice,
    colors: product.color || product.colors || [],
    category: categoryByProduct.get(Number(product.productId)) || product.category || 'Uncategorized',
  }))
  return products
}

function getPaginationItems(currentPage, totalPages) {
  const items = []
  for (let page = 1; page <= totalPages; page += 1) {
    const isVisible = page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)
    const isEllipsis = page === currentPage - 2 || page === currentPage + 2
    if (isVisible) items.push(page)
    else if (isEllipsis) items.push(`ellipsis-${page}`)
  }
  return items
}

function updateQuery(setSearchParams, searchParams, page, sort) {
  const nextParams = new URLSearchParams(searchParams)
  nextParams.set('page', String(page))
  nextParams.set('sort', sort)
  setSearchParams(nextParams, { replace: true })
}

function SortButton({ value, currentSort, onSelect, children }) {
  const selected = currentSort === value
  return (
    <button
      aria-pressed={selected}
      className={`flex h-10 min-w-[180px] items-center justify-between gap-2 rounded-full border px-4 text-left font-inter text-sm font-medium transition-colors ${selected
        ? 'border-[#373737] bg-transparent text-[#373737]'
        : 'border-[#d7cdbe] bg-white text-[#555]'}`}
      onClick={() => onSelect(value)}
      type="button"
    >
      {children}
    </button>
  )
}

function Pagination({ currentPage, totalPages, onSelect }) {
  const items = getPaginationItems(currentPage, totalPages)
  return (
    <nav aria-label="All products pagination" className="flex flex-col items-center gap-4 py-10">
      <ul className="flex flex-wrap items-center justify-center gap-1.5">
        <li><button aria-label="Previous page" className="min-w-10 rounded-full border border-[#d8d0c5] px-3 py-2 text-sm text-[#6f6962] disabled:opacity-40" disabled={currentPage === 1} onClick={() => onSelect(currentPage - 1)} type="button">Prev</button></li>
        {items.map((item, index) => (
          <li key={typeof item === 'number' ? `page-${item}` : `ellipsis-${index}`}>
            {typeof item === 'number'
              ? <button aria-current={item === currentPage ? 'page' : undefined} aria-label={`Page ${item}`} className={`grid h-10 min-w-10 place-items-center rounded-full border px-2 text-sm ${item === currentPage ? 'border-[#b89b6e] bg-[#b89b6e] text-white' : 'border-transparent text-[#6f6962] hover:border-[#d8d0c5]'}`} onClick={() => onSelect(item)} type="button">{item}</button>
              : <span aria-hidden="true" className="px-1 text-sm text-[#6f6962]">…</span>}
          </li>
        ))}
        <li><button aria-label="Next page" className="min-w-10 rounded-full border border-[#d8d0c5] px-3 py-2 text-sm text-[#6f6962] disabled:opacity-40" disabled={currentPage === totalPages} onClick={() => onSelect(currentPage + 1)} type="button">Next</button></li>
      </ul>
    </nav>
  )
}

function ProductCollection({ products, loading, error }) {
  if (error) return <p className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>
  if (loading) return <p className="py-8 text-sm text-[#8c857d]" role="status">Loading products…</p>
  if (!products.length) return <p className="py-12 text-center text-sm text-[#8c857d]">No products are available right now.</p>
  return (
    <div className="grid grid-cols-2 gap-4 min-[768px]:grid-cols-3 min-[992px]:grid-cols-4">
      {products.map((product) => <ProductCard catalogStyle key={product.productId} product={product} />)}
    </div>
  )
}

export default function AllProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const sort = getSort(searchParams.get('sort'))
  const requestedPage = getPage(searchParams.get('page'))

  useEffect(() => {
    let active = true
    loadCatalog()
      .then((catalog) => {
        if (active) setProducts(catalog)
      }, () => {
        if (active) setError('Products could not be loaded. Please try again later.')
      })
      .then(() => {
        if (active) setLoading(false)
      }, () => {
        if (active) {
          setError('Products could not be loaded. Please try again later.')
          setLoading(false)
        }
      })
    return () => { active = false }
  }, [])

  const sortedProducts = useMemo(() => {
    if (sort === 'newest') return products
    return [...products].sort((left, right) => Number(left.productId) - Number(right.productId))
  }, [products, sort])
  const totalPages = Math.max(1, Math.ceil(sortedProducts.length / PAGE_SIZE))
  const currentPage = Math.min(requestedPage, totalPages)
  const firstIndex = (currentPage - 1) * PAGE_SIZE
  const visibleProducts = sortedProducts.slice(firstIndex, firstIndex + PAGE_SIZE)
  const startItem = sortedProducts.length ? firstIndex + 1 : 0
  const endItem = Math.min(firstIndex + PAGE_SIZE, sortedProducts.length)

  useEffect(() => {
    if (!loading && (requestedPage !== currentPage || searchParams.get('sort') !== sort
      || searchParams.get('page') !== String(currentPage))) {
      updateQuery(setSearchParams, searchParams, currentPage, sort)
    }
  }, [currentPage, loading, requestedPage, searchParams, setSearchParams, sort])

  function selectSort(nextSort) {
    updateQuery(setSearchParams, searchParams, 1, nextSort)
  }

  function selectPage(nextPage) {
    updateQuery(setSearchParams, searchParams, Math.min(Math.max(nextPage, 1), totalPages), sort)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <main className="min-h-[55vh] bg-[#f6f4ef] py-6 text-[#333]">
      <div className="mx-auto w-full px-3 min-[576px]:max-w-[540px] min-[768px]:max-w-[720px] min-[992px]:max-w-[960px] min-[1200px]:max-w-[1140px] min-[1400px]:max-w-[1320px]">
        <h1 className="mb-1 font-inter text-[clamp(1.375rem,calc(1.375rem+1.5vw),2.5rem)] font-medium leading-[1.2]">All Products</h1>
        <p className="mb-3 text-base text-[#6c757d]">{loading ? 'Loading catalogue…' : `${sortedProducts.length} items`}</p>

        <div aria-label="Sort products" className="mb-4 flex flex-wrap gap-2">
          <SortButton currentSort={sort} onSelect={selectSort} value="recommended">Recommended</SortButton>
          <SortButton currentSort={sort} onSelect={selectSort} value="newest">New Arrivals</SortButton>
        </div>

        <ProductCollection error={error} loading={loading} products={visibleProducts} />

        {!loading && !error && <>
          <Pagination currentPage={currentPage} totalPages={totalPages} onSelect={selectPage} />
          <p className="-mt-6 text-center text-[13px] text-[#8c857d]">Showing {startItem}–{endItem} of {sortedProducts.length} products</p>
        </>}
      </div>
    </main>
  )
}
