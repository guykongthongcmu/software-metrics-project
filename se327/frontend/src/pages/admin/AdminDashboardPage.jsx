import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'
import './admin-dashboard.css'

const chartSeries = [
  { key: 'revenue', label: 'Revenue', color: '#c8a77d' },
  { key: 'orders', label: 'Orders', color: '#5b8db8' },
  { key: 'productsSold', label: 'Products sold', color: '#5c9b72' },
]

function numberValue(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatNumber(value) {
  return numberValue(value).toLocaleString('en-US')
}

function formatMoney(value, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(numberValue(value))
}

function formatGrowth(value) {
  const growth = numberValue(value)
  return `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%`
}

function formatChartLabel(value, granularity, period) {
  if (granularity === 'month') {
    const [year, month] = String(value).split('-').map(Number)
    if (!year || !month) return String(value || '')
    return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
  }
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return String(value || '')
  /** @type {Intl.DateTimeFormatOptions} */
  const options = period === 'weekly'
    ? { weekday: 'short', timeZone: 'UTC' }
    : { day: 'numeric', month: 'short', timeZone: 'UTC' }
  return date.toLocaleDateString('en-US', options)
}

function makePoints(values, maximum) {
  const points = Array.isArray(values) ? values : []
  if (!points.length) return ''
  const width = 640
  const height = 220
  const ceiling = maximum || 1
  return points.map((value, index) => {
    const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width
    const y = height - (numberValue(value) / ceiling) * height
    return `${x},${y}`
  }).join(' ')
}

function chartMaximum(chart) {
  return Math.max(1, ...chartSeries.flatMap(({ key }) => Array.isArray(chart?.[key]) ? chart[key].map(numberValue) : []))
}

function getResponseData(response) {
  return response?.data?.data || response?.data || {}
}

function getErrorMessage(error) {
  return error?.payload?.message || error?.message || 'Unable to load dashboard data. Please try again.'
}

function Growth({ value }) {
  const numericGrowth = numberValue(value)
  return <span className={`admin-stat-growth ${numericGrowth >= 0 ? 'is-positive' : 'is-negative'}`}>{formatGrowth(numericGrowth)}</span>
}

function RevenueChart({ charts, granularity, period }) {
  const maximum = chartMaximum(charts)
  const labels = Array.isArray(charts?.labels) ? charts.labels : []
  return (
    <div className="admin-dashboard-chart">
      <svg aria-label="Revenue, orders and products sold over time" role="img" viewBox="0 0 640 250" preserveAspectRatio="none">
        {[0, 1, 2, 3, 4].map((line) => <line key={line} x1="0" x2="640" y1={line * 55 + 5} y2={line * 55 + 5} className="admin-chart-gridline" />)}
        {chartSeries.map(({ key, label, color }) => <polyline key={key} aria-label={label} points={makePoints(charts?.[key], maximum)} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />)}
      </svg>
      <div aria-label="Chart dates" className="admin-chart-labels">
        {labels.map((label, index) => <span key={`${label}-${index}`}>{formatChartLabel(label, granularity, period)}</span>)}
      </div>
      <div className="admin-dashboard-legend">
        {chartSeries.map(({ key, label, color }) => <span key={key}><i style={{ backgroundColor: color }} />{label}</span>)}
      </div>
    </div>
  )
}

function CategoryChart({ categories }) {
  const safeCategories = Array.isArray(categories) ? categories.filter((item) => numberValue(item?.value) > 0) : []
  const total = safeCategories.reduce((sum, item) => sum + numberValue(item.value), 0)
  const circumference = 2 * Math.PI * 68
  return (
    <div className="admin-category-chart">
      <svg aria-label="Sales by category" role="img" viewBox="0 0 180 180">
        <circle cx="90" cy="90" r="68" fill="none" stroke="#e8e1d8" strokeWidth="22" />
        {safeCategories.map((item, index) => {
          const segment = (numberValue(item.value) / total) * circumference
          const previousSegments = safeCategories.slice(0, index).reduce((sum, category) => sum + (numberValue(category.value) / total) * circumference, 0)
          const circle = <circle key={`${item.label}-${index}`} cx="90" cy="90" r="68" fill="none" stroke={['#c8a77d', '#678bb1', '#78a17b', '#9c7ca5', '#d18b73', '#6d9e9b'][index % 6]} strokeWidth="22" strokeDasharray={`${segment} ${circumference - segment}`} strokeDashoffset={-previousSegments} transform="rotate(-90 90 90)" />
          return circle
        })}
        <text x="90" y="86" textAnchor="middle" className="admin-donut-total">{formatMoney(total)}</text>
        <text x="90" y="105" textAnchor="middle" className="admin-donut-caption">Sales</text>
      </svg>
      {safeCategories.length ? <ul className="admin-category-legend">{safeCategories.map((item, index) => <li key={`${item.label}-${index}`}><span><i style={{ backgroundColor: ['#c8a77d', '#678bb1', '#78a17b', '#9c7ca5', '#d18b73', '#6d9e9b'][index % 6] }} />{item.label}</span><strong>{formatMoney(item.value)}</strong></li>)}</ul> : <p className="admin-dashboard-empty">No sales data found</p>}
    </div>
  )
}

function KpiCard({ label, value, growth, color, currency = null }) {
  const formattedValue = currency ? formatMoney(value, currency) : formatNumber(value)
  return <article className="admin-dashboard-kpi"><span className={`admin-kpi-icon ${color}`} aria-hidden="true">{label === 'Total Revenue' ? '$' : label === 'Total Orders' ? '▣' : label === 'Products Sold' ? '□' : '↗'}</span><Growth value={growth} /><p>{label}</p><strong>{formattedValue}</strong></article>
}

export default function AdminDashboardPage() {
  const [period, setPeriod] = useState('weekly')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadDashboard(selectedPeriod = period, rangeFrom = from, rangeTo = to, showLoading = true) {
    if (showLoading) {
      setLoading(true)
      setError('')
    }
    const query = selectedPeriod === 'custom'
      ? `period=custom&from=${encodeURIComponent(rangeFrom)}&to=${encodeURIComponent(rangeTo)}`
      : `period=${selectedPeriod}`
    try {
      const response = await apiClient.get(`/admin/dashboard/summary?${query}`)
      setDashboard(getResponseData(response))
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    apiClient.get('/admin/dashboard/summary?period=weekly')
      .then((response) => {
        if (active) setDashboard(getResponseData(response))
      })
      .catch((requestError) => {
        if (active) setError(getErrorMessage(requestError))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const data = dashboard || {}
  const periodGranularity = data.period?.granularity || (period === 'monthly' ? 'month' : 'day')
  const topSellers = Array.isArray(data.topSellers) ? data.topSellers : []
  const periodText = useMemo(() => data.period?.from && data.period?.to ? `Trend from ${data.period.from} to ${data.period.to}` : 'Trend for selected period', [data.period?.from, data.period?.to])

  function choosePeriod(nextPeriod) {
    setPeriod(nextPeriod)
    void loadDashboard(nextPeriod).catch(() => {})
  }

  function applyCustomRange(event) {
    event.preventDefault()
    if (!from || !to) {
      setError('Select both dates to view a custom range.')
      return
    }
    if (from > to) {
      setError('The start date must be before the end date.')
      return
    }
    setPeriod('custom')
    void loadDashboard('custom', from, to).catch(() => {})
  }

  return (
    <section className="admin-dashboard-page">
      <header className="admin-feature-header">
        <div><h2>Dashboard</h2><p>Welcome back! Here's what's happening with your store.</p></div>
        <form className="admin-dashboard-range" onSubmit={applyCustomRange}>
          <label><span>From</span><input aria-label="Custom range start" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label><span>To</span><input aria-label="Custom range end" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
          <button className="admin-feature-button" type="submit">Apply range</button>
        </form>
      </header>
      {error && <p className="admin-feature-error" role="alert">{error}</p>}
      <div className="admin-dashboard-kpis">
        <KpiCard label="Total Revenue" value={data.revenue?.total} growth={data.revenue?.growth} color="golden" currency={data.revenue?.currency || 'USD'} />
        <KpiCard label="Total Orders" value={data.orders?.total} growth={data.orders?.growth} color="blue" />
        <KpiCard label="Products Sold" value={data.productsSold?.total} growth={data.productsSold?.growth} color="green" />
        <KpiCard label="Overall Growth" value={data.productsSold?.growth} growth={data.productsSold?.growth} color="purple" />
      </div>
      <div className="admin-dashboard-grid">
        <article className="admin-feature-card admin-revenue-card">
          <div className="admin-dashboard-card-header"><div><h3>Revenue Overview</h3><p>{periodText}</p></div><div aria-label="Dashboard period" className="admin-period-tabs">{['weekly', 'monthly'].map((item) => <button aria-pressed={period === item} className={period === item ? 'active' : ''} key={item} onClick={() => choosePeriod(item)} type="button">{item === 'weekly' ? 'Weekly' : 'Monthly'}</button>)}</div></div>
          {loading ? <p className="admin-dashboard-empty" role="status">Loading dashboard...</p> : <RevenueChart charts={data.charts} granularity={periodGranularity} period={period} />}
        </article>
        <article className="admin-feature-card">
          <h3>Sales by Category</h3>
          {loading ? <p className="admin-dashboard-empty" role="status">Loading categories...</p> : <CategoryChart categories={data.salesByCategory} />}
        </article>
        <article className="admin-feature-card admin-sellers-card">
          <div className="admin-dashboard-card-header"><h3>Top Sellers</h3><Link className="admin-feature-link" to="/admin/products">All Products →</Link></div>
          {loading ? <p className="admin-dashboard-empty" role="status">Loading top sellers...</p> : topSellers.length ? <div className="admin-top-sellers">{topSellers.map((seller, index) => <Link className="admin-top-seller" key={seller.productId} to={`/admin/products/edit/${seller.productId}`}><b>#{index + 1}</b><span><strong>{seller.label || 'Unnamed product'}</strong><small>{seller.category || '—'}</small></span><span className="admin-seller-likes">♥ {formatNumber(seller.likesCount)}</span><span className="admin-seller-sales">{formatNumber(seller.salesValue)} sold</span></Link>)}</div> : <p className="admin-dashboard-empty">No sales data found</p>}
        </article>
        <article className="admin-dashboard-viewers"><span aria-hidden="true">◉</span><p>Unique Viewers</p><strong>{loading ? '—' : formatNumber(data.uniqueViewers)}</strong><small>Total audience reach</small></article>
      </div>
    </section>
  )
}
