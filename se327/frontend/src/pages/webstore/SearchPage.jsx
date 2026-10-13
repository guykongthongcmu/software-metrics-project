import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'
import ProductCard from './partials/ProductCard.jsx'

const PAGE_SIZE = 12
const API_PAGE_SIZE = 50
const CATEGORY_SLUGS = new Set(['men', 'women', 'kids', 'baby', 'unisex'])
const SORT_OPTIONS = [
  { key: 'relevance', label: 'Recommended' },
  { key: 'price_asc', label: 'Lowest Price' },
  { key: 'price_desc', label: 'Highest Price' },
  { key: 'newest', label: 'Newest' },
]

function readPage(value) {
  const parsed = Number.parseInt(value || '', 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}

function normalizeProduct(product) {
  return {
    ...product,
    image: product.image || product.imageUrl,
    colors: product.color || product.colors || [],
  }
}

async function fetchSearchProducts(query, sort, categorySlug = '') {
  const buildPath = (page) => {
    const routeSort = sort === 'relevance' ? 'newest' : sort
    const params = new URLSearchParams({ page: String(page), limit: String(API_PAGE_SIZE), sort: routeSort, lang: 'EN' })
    if (categorySlug) return `/client/products/category/${encodeURIComponent(categorySlug)}?${params.toString()}`
    params.set('q', query)
    return `/client/products/search?${params.toString()}`
  }
  const firstResponse = await apiClient.get(buildPath(1), { redirectOn401: false })
  const firstData = firstResponse?.data
  if (!Array.isArray(firstData?.products)) throw new Error('Unexpected search response')

  const totalPages = Math.max(1, Number(firstData.pagination?.totalPages) || 1)
  const otherResponses = await Promise.all(Array.from(
    { length: totalPages - 1 },
    (_, index) => apiClient.get(buildPath(index + 2), { redirectOn401: false }),
  ))
  const pages = [firstData, ...otherResponses.map((response) => response?.data)]
  if (pages.some((page) => !Array.isArray(page?.products))) throw new Error('Unexpected search response')

  return {
    products: pages.flatMap((page) => page.products).map((product) => normalizeProduct({
      ...product,
      category: product.category || (categorySlug ? firstData.category : undefined),
    })),
    categoryCounts: Array.isArray(firstData.categoryCounts)
      ? firstData.categoryCounts
      : categorySlug && firstData.category
        ? [{ ...firstData.category, count: Number(firstData.pagination?.totalItems) || 0 }]
        : [],
    totalResults: Number(firstData.pagination?.totalItems) || 0,
  }
}

function buildPaginationItems(currentPage, totalPages) {
  const items = []
  for (let page = 1; page <= totalPages; page += 1) {
    const visible = page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)
    const ellipsis = page === currentPage - 2 || page === currentPage + 2
    if (visible) items.push(page)
    else if (ellipsis) items.push(`ellipsis-${page}`)
  }
  return items
}

function makeSearchParams(searchParams, updates) {
  const next = new URLSearchParams(searchParams)
  Object.entries(updates).forEach(([key, value]) => {
    if (value == null || value === '') next.delete(key)
    else next.set(key, String(value))
  })
  return next
}

function SearchIcon() {
  return <svg aria-hidden="true" className="absolute left-[22px] top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#b89b6e]" fill="none" viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.8" stroke="currentColor" strokeWidth="1.6" /><path d="m16 16 5 5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" /></svg>
}

function SearchForm({ value, onSubmit, placeholder, autoFocus = false, className = '' }) {
  return (
    <form className={`relative w-full ${className}`} onSubmit={onSubmit} role="search">
      <SearchIcon />
      <input
        aria-label="Search products"
        autoComplete="off"
        autoFocus={autoFocus}
        className="h-[60px] w-full rounded-full border-[1.5px] border-[#d7cdbe] bg-white pl-14 pr-6 text-[17px] text-[#333] shadow-sm outline-none transition focus:border-[#b89b6e] focus:shadow-[0_0_0_3px_rgba(201,168,126,0.15)] placeholder:text-[#8c857d] placeholder:opacity-70 max-[768px]:h-[54px] max-[768px]:text-base"
        defaultValue={value}
        name="q"
        placeholder={placeholder}
        type="search"
      />
    </form>
  )
}

function SuggestionList({ suggestions }) {
  if (!suggestions.length) return null
  return (
    <section aria-labelledby="suggestions-title" className="w-full max-w-[700px]">
      <h2 className="mb-2 px-1 text-base font-semibold text-[#333]" id="suggestions-title">Product suggestions</h2>
      <ul className="border-t border-[#e7e0d6]">
        {suggestions.map((product, index) => (
          <li className="border-b border-[#e7e0d6]" key={product.productId || product.id || `${product.name}-${index}`}>
            <Link className="flex items-center gap-4 px-1 py-4 transition-colors hover:bg-[#c9a87e]/[0.04]" to={`/search?q=${encodeURIComponent(product.name)}`}>
              <span className="h-[52px] w-[52px] shrink-0 overflow-hidden rounded-full bg-[#ededec]">
                <img alt={product.name} className="h-full w-full object-cover" loading="lazy" src={product.image} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                <span className="truncate text-[15px] font-medium text-[#333]">{product.name}</span>
                <span className="text-[13px] text-[#777]">{product.category?.name || product.category || ''}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-0.5">
                {product.originalPrice != null && <span className="text-xs text-[#555] line-through">${Number(product.originalPrice).toLocaleString('en-US')}</span>}
                <span className={`text-sm font-semibold ${product.originalPrice != null ? 'text-[#c0392b]' : 'text-[#555]'}`}>${Number(product.price).toLocaleString('en-US')}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Link className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[#b89b6e] transition-all hover:gap-3" to="/search?q=">
        View all results <span aria-hidden="true">→</span>
      </Link>
    </section>
  )
}

function SortMenu({ sort, onSelect }) {
  const [open, setOpen] = useState(false)
  const selectedLabel = SORT_OPTIONS.find((option) => option.key === sort)?.label || 'Recommended'

  useEffect(() => {
    if (!open) return undefined
    const closeOnOutsideClick = (event) => {
      if (!event.target.closest('[data-search-sort]')) setOpen(false)
    }
    document.addEventListener('click', closeOnOutsideClick)
    return () => document.removeEventListener('click', closeOnOutsideClick)
  }, [open])

  return (
    <div className="relative" data-search-sort>
      <button aria-expanded={open} className="flex h-10 min-w-[180px] items-center justify-between gap-2 rounded-full border border-[#d7cdbe] bg-white px-4 text-sm font-medium text-[#555] transition-colors hover:border-[#b89b6e]" onClick={() => setOpen((value) => !value)} type="button">
        <span>Sort by: {selectedLabel}</span>
        <svg aria-hidden="true" className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="m19 9-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>
      </button>
      {open && <ul className="absolute right-0 top-[calc(100%+8px)] z-[200] min-w-[200px] overflow-hidden rounded-2xl border border-[#e7e0d6] bg-white py-1 shadow-lg" role="listbox" aria-label="Sort search results">
        {SORT_OPTIONS.map((option) => <li className="hover:bg-[#f6f4ef]" key={option.key}>
          <button aria-selected={sort === option.key} className={`block w-full px-5 py-3 text-left text-sm ${sort === option.key ? 'font-semibold text-[#b89b6e]' : 'font-medium text-[#555]'}`} onClick={() => { onSelect(option.key); setOpen(false) }} role="option" type="button">{option.label}</button>
        </li>)}
      </ul>}
    </div>
  )
}

function SearchPagination({ page, totalPages, onPageChange, query, category, sort, totalResults }) {
  if (totalPages <= 1) return null
  const items = buildPaginationItems(page, totalPages)
  const pageLink = (nextPage) => {
    const params = new URLSearchParams({ q: query, cat: category, sort, page: String(nextPage) })
    return `/search?${params.toString()}`
  }
  return (
    <nav aria-label="Page navigation" className="flex flex-col items-center gap-4 py-10 pb-5">
      <ul className="flex flex-wrap items-center justify-center gap-1.5">
        <li>{page > 1 ? <Link aria-label="Previous" className="inline-flex h-10 min-w-10 items-center justify-center rounded-full border border-[#d7cdbe] px-3 text-sm text-[#555]" onClick={(event) => { event.preventDefault(); onPageChange(page - 1) }} to={pageLink(page - 1)}>‹</Link> : <span aria-hidden="true" className="inline-flex h-10 min-w-10 items-center justify-center rounded-full border border-[#d7cdbe] px-3 text-sm text-[#555] opacity-35">‹</span>}</li>
        {items.map((item, index) => <li key={typeof item === 'number' ? `page-${item}` : `ellipsis-${index}`}>
          {typeof item === 'number' ? <Link aria-current={item === page ? 'page' : undefined} aria-label={`Page ${item}`} className={`inline-flex h-10 min-w-10 items-center justify-center rounded-full border px-1 text-sm font-medium ${item === page ? 'border-[#b89b6e] bg-[#b89b6e] text-white' : 'border-transparent text-[#555] hover:border-[#d7cdbe]'}`} onClick={(event) => { event.preventDefault(); onPageChange(item) }} to={pageLink(item)}>{item}</Link> : <span aria-hidden="true" className="px-1 text-sm text-[#555]">…</span>}
        </li>)}
        <li>{page < totalPages ? <Link aria-label="Next" className="inline-flex h-10 min-w-10 items-center justify-center rounded-full border border-[#d7cdbe] px-3 text-sm text-[#555]" onClick={(event) => { event.preventDefault(); onPageChange(page + 1) }} to={pageLink(page + 1)}>›</Link> : <span aria-hidden="true" className="inline-flex h-10 min-w-10 items-center justify-center rounded-full border border-[#d7cdbe] px-3 text-sm text-[#555] opacity-35">›</span>}</li>
      </ul>
      <p className="text-[13px] text-[#555]">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalResults)} of {totalResults} results</p>
    </nav>
  )
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const query = (searchParams.get('q') || '').trim()
  const requestedSort = searchParams.get('sort') || 'relevance'
  const sort = SORT_OPTIONS.some((option) => option.key === requestedSort) ? requestedSort : 'relevance'
  const category = searchParams.get('cat') || 'all'
  const requestedPage = readPage(searchParams.get('page'))
  const [products, setProducts] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [categories, setCategories] = useState([])
  const [categoryCounts, setCategoryCounts] = useState([])
  const [totalResults, setTotalResults] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      setError('')
      const categoryRequest = apiClient.get('/client/categories?sort=category_name&order=asc', { redirectOn401: false })
        .then((response) => Array.isArray(response?.data?.categories) ? response.data.categories : [])
        .catch(() => [])
      try {
        if (!query) {
          const response = await apiClient.get('/client/products/search/suggestions?q=a&lang=EN', { redirectOn401: false })
          const categoryList = await categoryRequest
          if (active) {
            setCategories(categoryList)
            setSuggestions(Array.isArray(response?.data?.suggestions) ? response.data.suggestions.slice(0, 4) : [])
            setProducts([])
            setCategoryCounts([])
            setTotalResults(0)
          }
        } else {
          const querySlug = query.toLowerCase() === 'kid' ? 'kids' : query.toLowerCase()
          const categorySlug = CATEGORY_SLUGS.has(querySlug) ? querySlug : ''
          const [results, categoryList] = await Promise.all([fetchSearchProducts(query, sort, categorySlug), categoryRequest])
          if (active) {
            setCategories(categoryList)
            setProducts(results.products)
            setCategoryCounts(results.categoryCounts)
            setTotalResults(results.totalResults)
            setSuggestions([])
          }
        }
      } catch {
        if (active) setError('Search could not be loaded. Please try again later.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [query, sort])

  const filteredProducts = useMemo(() => category === 'all'
    ? products
    : products.filter((product) => product.category?.slug === category), [category, products])
  const totalPages = Math.ceil(filteredProducts.length / PAGE_SIZE)
  const page = Math.min(requestedPage, Math.max(1, totalPages))
  const visibleProducts = filteredProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => {
    if (query && !loading && (requestedPage !== page || requestedSort !== sort)) {
      const next = makeSearchParams(searchParams, { page: page > 1 ? page : null, sort: sort === 'relevance' ? null : sort })
      setSearchParams(next, { replace: true })
    }
  }, [loading, page, query, requestedPage, requestedSort, searchParams, setSearchParams, sort])

  function submitSearch(event) {
    event.preventDefault()
    const nextQuery = String(new FormData(event.currentTarget).get('q') || '').trim()
    navigate(nextQuery ? `/search?q=${encodeURIComponent(nextQuery)}` : '/search')
  }

  function selectSort(nextSort) {
    setSearchParams(makeSearchParams(searchParams, { sort: nextSort === 'relevance' ? null : nextSort, page: null }), { replace: true })
  }

  function selectCategory(nextCategory) {
    setSearchParams(makeSearchParams(searchParams, { cat: nextCategory === 'all' ? null : nextCategory, page: null }), { replace: true })
  }

  function selectPage(nextPage) {
    setSearchParams(makeSearchParams(searchParams, { page: nextPage > 1 ? nextPage : null }), { replace: true })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!query) {
    return (
      <main className="mx-auto flex w-full max-w-[1280px] flex-col items-center gap-12 px-6 pb-20 pt-16 max-[768px]:gap-8 max-[768px]:py-10 max-[575px]:px-4">
        <SearchForm autoFocus key={query} onSubmit={submitSearch} placeholder="Type here to search..." value={query} />
        {loading && <p className="text-sm text-[#777]" role="status">Loading product suggestions…</p>}
        {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
        <SuggestionList suggestions={suggestions} />
      </main>
    )
  }

  const facetCounts = new Map(categoryCounts.map((item) => [item.slug, item.count]))
  const allCount = totalResults
  const chips = [{ slug: 'all', label: 'All', count: allCount }, ...categories.map((item) => ({
    slug: item.slug,
    label: item.categoryName,
    count: facetCounts.get(item.slug) || 0,
  }))]

  return (
    <main className="mx-auto w-full max-w-[1280px] px-6 max-[575px]:px-4">
      <section className="flex animate-[searchFadeUp_.4s_ease_both] flex-col items-center gap-3 py-10 pb-6">
        <p className="text-sm font-medium uppercase tracking-[1.4px] text-[#555]">Search Result</p>
        <h1 className="font-display text-[clamp(44px,7vw,72px)] font-light leading-none tracking-[-1.8px] text-[#333] max-[768px]:text-[44px] max-[575px]:text-4xl">{query}</h1>
        <SearchForm className="max-w-[672px]" key={query} onSubmit={submitSearch} placeholder="Search for anything…" value={query} />
      </section>

      <section aria-label="Search filters" className="sticky top-0 z-[90] -mx-6 border-b border-[#e7e0d6] bg-[#f6f4ef] px-6 py-4 max-[768px]:py-3 max-[575px]:-mx-4 max-[575px]:px-4">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3">
          <nav aria-label="Filter by category" className="flex flex-wrap gap-2.5">
            {chips.map((chip) => <button aria-pressed={category === chip.slug} className={`inline-flex h-10 items-center whitespace-nowrap rounded-full border px-5 text-sm font-medium transition-colors max-[768px]:h-9 max-[768px]:px-3.5 max-[768px]:text-[13px] ${category === chip.slug ? 'border-[#b89b6e] bg-[#b89b6e] text-white' : 'border-[#d7cdbe] bg-transparent text-[#555] hover:border-[#b89b6e] hover:text-[#333]'}`} key={chip.slug} onClick={() => selectCategory(chip.slug)} type="button">{chip.label} ({chip.count})</button>)}
          </nav>
          <SortMenu onSelect={selectSort} sort={sort} />
        </div>
      </section>

      <section aria-label="Search results" className="py-7 pb-20">
        {loading && <p className="py-12 text-center text-sm text-[#777]" role="status">Loading products…</p>}
        {error && <p className="py-12 text-center text-sm text-red-700" role="alert">{error}</p>}
        {!loading && !error && visibleProducts.length === 0 && <div className="flex animate-[searchFadeUp_.4s_ease_both] flex-col items-center gap-4 px-6 py-20 text-center">
          <svg aria-hidden="true" className="h-12 w-12 text-[#b89b6e]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.8" strokeWidth="1.5" /><path d="m16 16 5 5M4 4l16 16" strokeLinecap="round" strokeWidth="1.5" /></svg>
          <h2 className="text-2xl font-semibold text-[#333]">No results for “{query}”</h2>
          <p className="text-[15px] text-[#555]">Try different keywords or browse our categories.</p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">{chips.filter((chip) => chip.slug !== 'all').slice(0, 3).map((chip) => <button className="inline-flex h-10 items-center rounded-full border border-[#d7cdbe] px-5 text-sm text-[#555] hover:border-[#b89b6e]" key={chip.slug} onClick={() => navigate(`/search?q=${encodeURIComponent(chip.slug)}&cat=${chip.slug}`)} type="button">{chip.label}</button>)}</div>
        </div>}
        {!loading && !error && visibleProducts.length > 0 && <>
          <div className="grid grid-cols-1 gap-8 min-[769px]:grid-cols-2 min-[1025px]:grid-cols-4">
            {visibleProducts.map((product, index) => <div className="animate-[searchFadeUp_.35s_ease_both]" key={product.productId} style={{ animationDelay: `${index * 0.04}s` }}><ProductCard product={product} /></div>)}
          </div>
          <SearchPagination category={category} onPageChange={selectPage} page={page} query={query} sort={sort} totalPages={totalPages} totalResults={filteredProducts.length} />
        </>}
      </section>
      <style>{'@keyframes searchFadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}'}</style>
    </main>
  )
}
