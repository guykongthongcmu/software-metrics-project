import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'
import './admin-dashboard.css'

const categoryColors = ['#c8a77d', '#d7cdbe', '#8f8272', '#e9dec1', '#b89468']
const calendarToday = new Date()
const defaultRangeEnd = getDateKey(calendarToday)
const defaultRangeStartDate = new Date(calendarToday)
defaultRangeStartDate.setDate(defaultRangeStartDate.getDate() - 7)
const defaultRangeStart = getDateKey(defaultRangeStartDate)

function numberValue(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatNumber(value) {
  return numberValue(value).toLocaleString('en-US')
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

function getResponseData(response) {
  return response?.data?.data || response?.data || {}
}

function getErrorMessage(error) {
  return error?.payload?.message || error?.message || 'Unable to load dashboard data. Please try again.'
}

function notifyAdmin(title, message, type = 'danger') {
  window.dispatchEvent(new CustomEvent('admin:toast', { detail: { title, message, type } }))
}

function calculateGrowth(values) {
  if (!Array.isArray(values) || values.length < 2) return 0
  const current = numberValue(values.at(-1))
  const previous = values.slice(0, -1).map(numberValue)
  const average = previous.reduce((sum, value) => sum + value, 0) / previous.length
  if (average === 0) return current > 0 ? 100 : 0
  return ((current - average) / average) * 100
}

function getNiceStep(rawStep) {
  if (!Number.isFinite(rawStep) || rawStep <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const normalized = rawStep / magnitude
  if (normalized <= 1) return magnitude
  if (normalized <= 2) return 2 * magnitude
  if (normalized <= 5) return 5 * magnitude
  return 10 * magnitude
}

function getRevenueAxis(values) {
  const numericValues = (Array.isArray(values) ? values : []).map(numberValue)
  const rawMin = Math.min(...numericValues)
  const rawMax = Math.max(...numericValues)
  if (!numericValues.length || rawMax <= 0) return { min: 0, max: 10, step: 2 }
  if (rawMin === rawMax) {
    const padding = Math.max(rawMax * 0.15, 1)
    const step = getNiceStep((padding * 2) / 5)
    return { min: Math.max(0, rawMin - padding), max: rawMax + padding, step }
  }
  const padding = Math.max((rawMax - rawMin) * 0.18, rawMax * 0.03, 1)
  const step = getNiceStep((rawMax - Math.max(0, rawMin - padding) + padding) / 5)
  return {
    min: Math.floor(Math.max(0, rawMin - padding) / step) * step,
    max: Math.ceil((rawMax + padding) / step) * step,
    step,
  }
}

function formatAxisValue(value) {
  if (value >= 1000) return `$${(value / 1000).toFixed(1).replace('.0', '')}k`
  return `$${formatNumber(value)}`
}

function getRevenuePoints(values, axis) {
  const chart = Array.isArray(values) ? values : []
  const plot = { left: 58, top: 16, width: 700, height: 260 }
  return chart.map((value, index) => {
    const x = chart.length === 1 ? plot.left + plot.width / 2 : plot.left + (index / (chart.length - 1)) * plot.width
    const y = plot.top + plot.height - ((numberValue(value) - axis.min) / (axis.max - axis.min)) * plot.height
    return { x, y, value: numberValue(value) }
  })
}

function makeCurvePath(points) {
  if (!points.length) return ''
  return points.reduce((path, point, index) => {
    if (!index) return `M${point.x} ${point.y}`
    const previous = points[index - 1]
    const handle = (point.x - previous.x) * 0.4
    return `${path} C${previous.x + handle} ${previous.y} ${point.x - handle} ${point.y} ${point.x} ${point.y}`
  }, '')
}

function RevenueChart({ charts, granularity, period }) {
  const labels = Array.isArray(charts?.labels) ? charts.labels : []
  const values = Array.isArray(charts?.revenue) ? charts.revenue : []
  const axis = getRevenueAxis(values)
  const points = getRevenuePoints(values, axis)
  const line = makeCurvePath(points)
  const area = points.length ? `${line} L${points.at(-1).x} 276 L${points[0].x} 276 Z` : ''
  const ticks = Array.from({ length: 6 }, (_, index) => axis.max - ((axis.max - axis.min) / 5) * index)

  return (
    <div className="admin-dashboard-chart">
      <svg aria-label="Revenue over time" className="admin-revenue-svg" role="img" viewBox="0 0 780 320" preserveAspectRatio="none">
        {ticks.map((tick, index) => {
          const y = 16 + index * 52
          return <g key={`${tick}-${index}`}><line x1="58" x2="758" y1={y} y2={y} className="admin-chart-gridline" /><text x="48" y={y + 4} className="admin-axis-label" textAnchor="end">{formatAxisValue(tick)}</text></g>
        })}
        <line x1="58" x2="58" y1="16" y2="276" className="admin-chart-axis" />
        <line x1="58" x2="758" y1="276" y2="276" className="admin-chart-axis" />
        {area && <path d={area} className="admin-revenue-area" />}
        {line && <path d={line} className="admin-revenue-line" />}
        {points.map((point, index) => <g key={`${labels[index]}-${index}`}><circle cx={point.x} cy={point.y} r="3.5" className="admin-revenue-point"><title>{`${formatChartLabel(labels[index], granularity, period)}: $${formatNumber(point.value)}`}</title></circle><text x={point.x} y={point.y - 8} className="admin-point-label" textAnchor="middle">{formatNumber(point.value)}</text></g>)}
      </svg>
      <div aria-label="Chart dates" className="admin-chart-labels">{labels.map((label, index) => <span key={`${label}-${index}`}>{formatChartLabel(label, granularity, period)}</span>)}</div>
    </div>
  )
}

function CategoryChart({ categories }) {
  const safeCategories = Array.isArray(categories) && categories.length
    ? categories
    : ['Men', 'Women', 'Kids', 'Baby', 'Unisex'].map((label) => ({ label, value: 0 }))
  const total = safeCategories.reduce((sum, item) => sum + numberValue(item?.value), 0)
  const circumference = 2 * Math.PI * 82
  return (
    <div className="admin-category-chart">
      <svg aria-label="Sales by category" className="admin-donut-svg" role="img" viewBox="0 0 220 220">
        {safeCategories.map((item, index) => {
          const value = numberValue(item?.value)
          const segment = total ? (value / total) * circumference : 0
          const arcOffset = safeCategories.slice(0, index).reduce((sum, category) => sum + (total ? (numberValue(category?.value) / total) * circumference : 0), 0)
          const midpoint = total ? ((arcOffset + segment / 2) / circumference) * Math.PI * 2 - Math.PI / 2 : 0
          const labelX = 110 + Math.cos(midpoint) * 82
          const labelY = 110 + Math.sin(midpoint) * 82
          const percentage = total > 0 ? `${((value / total) * 100).toFixed(1)}%` : '0.0%'
          return <g key={`${item?.label}-${index}`}><circle cx="110" cy="110" r="82" fill="none" stroke={categoryColors[index % categoryColors.length]} strokeWidth="28" strokeDasharray={`${segment} ${circumference - segment}`} strokeDashoffset={-arcOffset} transform="rotate(-90 110 110)"><title>{`${item?.label || 'Category'}: ${formatNumber(value)}`}</title></circle>{value > 0 && <text x={labelX} y={labelY + 4} className="admin-donut-label" textAnchor="middle">{percentage}</text>}</g>
        })}
      </svg>
      <div className="admin-category-legend">{safeCategories.map((item, index) => <span key={`${item?.label}-${index}`}><i style={{ backgroundColor: categoryColors[index % categoryColors.length] }} />{item?.label || 'Category'}</span>)}</div>
    </div>
  )
}

function Growth({ value }) {
  const numericGrowth = numberValue(value)
  const className = numericGrowth >= 0 ? 'positive' : 'negative'
  return <span className={`admin-stat-growth ${className}`}>{formatGrowth(numericGrowth)}</span>
}

function KpiCard({ label, value, growth, color, currency = false, overall = false, index = 0 }) {
  const displayValue = overall ? formatGrowth(value) : currency ? `$${formatNumber(value)}` : formatNumber(value)
  const icon = label === 'Total Revenue' ? <><path d="M2 3h1l1.5 8h7.8l1.5-5.5H4" /><circle cx="6" cy="13.5" r="1" /><circle cx="12" cy="13.5" r="1" /><path d="m8 5 1.5 1.5L12 4" /></> : label === 'Total Orders' ? <><path d="M4 5h8l1 9H3z" /><path d="M6 5a2 2 0 0 1 4 0" /></> : label === 'Products Sold' ? <><path d="m8 2 6 3.2v7L8 15l-6-2.8v-7z" /><path d="M2 5.2 8 8.5l6-3.3M8 8.5V15" /></> : <><path d="M2 13V9h3v4zm5 0V6h3v7zm5 0V3h3v10z" /><path d="m2 7 4-3 3 1 5-4" /></>
  return (
    <article className={`admin-dashboard-kpi fade-in-delay-${index}`}>
      <span aria-hidden="true" className={`admin-kpi-icon ${color}`}><svg viewBox="0 0 16 16">{icon}</svg></span>
      <Growth value={growth} />
      <div className="admin-kpi-label">{label}</div>
      <div className="admin-kpi-value">{displayValue}</div>
    </article>
  )
}

function getDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function DateRangePicker({ from, to, onSelectRange }) {
  const [open, setOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => new Date())
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const gridStart = new Date(year, month, 1 - firstDay.getDay())
  const today = getDateKey(calendarToday)
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart)
    day.setDate(gridStart.getDate() + index)
    return day
  })
  const rangeLabel = from && to ? `${from} to ${to}` : from ? `${from} to …` : 'Select Date Range'
  const previousMonth = new Date(year, month - 1, 1)
  const nextMonth = new Date(year, month + 1, 1)
  const nextMonthDisabled = nextMonth > new Date(calendarToday.getFullYear(), calendarToday.getMonth(), 1)

  function selectDay(date) {
    const dateKey = getDateKey(date)
    if (!from || to) {
      onSelectRange(dateKey, '')
      return
    }
    const [start, end] = dateKey < from ? [dateKey, from] : [from, dateKey]
    onSelectRange(start, end)
    setOpen(false)
  }

  return (
    <div className="admin-dashboard-range-wrap" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
      <button aria-expanded={open} className="admin-dashboard-range-trigger" onClick={() => setOpen((value) => !value)} type="button"><svg aria-hidden="true" viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="11" rx="1" /><path d="M5 1v4M11 1v4M2 6h12" /></svg>{rangeLabel}</button>
      {open && <div aria-label="Select date range" className="admin-dashboard-range-popover">
        <div className="admin-calendar-header"><button aria-label="Previous month" onClick={() => setViewDate(previousMonth)} type="button">‹</button><label><select aria-label="Calendar month" onChange={(event) => setViewDate(new Date(year, Number(event.target.value), 1))} value={month}>{Array.from({ length: 12 }, (_, index) => <option key={index} value={index}>{new Date(year, index, 1).toLocaleDateString('en-US', { month: 'long' })}</option>)}</select></label><select aria-label="Calendar year" onChange={(event) => setViewDate(new Date(Number(event.target.value), month, 1))} value={year}>{Array.from({ length: 11 }, (_, index) => year - 5 + index).map((item) => <option key={item} value={item}>{item}</option>)}</select><button aria-label="Next month" disabled={nextMonthDisabled} onClick={() => setViewDate(nextMonth)} type="button">›</button></div>
        <div className="admin-calendar-weekdays">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="admin-calendar-days">{calendarDays.map((date) => {
          const key = getDateKey(date)
          const isCurrentMonth = date.getMonth() === month
          const isStart = key === from
          const isEnd = key === to
          const isSelected = isStart || isEnd
          const inRange = from && to && key > from && key < to
          const isFuture = key > today
          const dayClass = ['admin-calendar-day', !isCurrentMonth && 'is-other-month', inRange && 'in-range', isSelected && 'is-selected', isStart && 'is-range-start', isEnd && 'is-range-end'].filter(Boolean).join(' ')
          return <button aria-label={date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} className={dayClass} disabled={isFuture} key={key} onClick={() => selectDay(date)} type="button">{date.getDate()}</button>
        })}</div>
      </div>}
    </div>
  )
}

export default function AdminDashboardPage() {
  const [period, setPeriod] = useState('weekly')
  const [from, setFrom] = useState(defaultRangeStart)
  const [to, setTo] = useState(defaultRangeEnd)
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadDashboard(selectedPeriod = period, rangeFrom = from, rangeTo = to, showLoading = true) {
    if (showLoading) {
      setLoading(true)
    }
    const query = selectedPeriod === 'custom'
      ? `period=custom&from=${encodeURIComponent(rangeFrom)}&to=${encodeURIComponent(rangeTo)}`
      : `period=${selectedPeriod}`
    try {
      const response = await apiClient.get(`/admin/dashboard/summary?${query}`)
      setDashboard(getResponseData(response))
    } catch (requestError) {
      notifyAdmin('Dashboard Error', getErrorMessage(requestError))
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
        if (active) notifyAdmin('Dashboard Error', getErrorMessage(requestError))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const data = dashboard || {}
  const charts = data.charts || {}
  const revenueGrowth = calculateGrowth(charts.revenue)
  const ordersGrowth = calculateGrowth(charts.orders)
  const productsGrowth = calculateGrowth(charts.productsSold)
  const periodGranularity = data.period?.granularity || (period === 'monthly' ? 'month' : 'day')
  const topSellers = Array.isArray(data.topSellers) ? data.topSellers : []
  const periodText = useMemo(() => data.period?.from && data.period?.to ? `Trend from ${data.period.from} to ${data.period.to}` : 'Trend for selected period', [data.period?.from, data.period?.to])

  function choosePeriod(nextPeriod) {
    setPeriod(nextPeriod)
    void loadDashboard(nextPeriod).catch(() => {})
  }

  function applyDateRange(start, end) {
    setFrom(start)
    setTo(end)
    if (!start || !end) return
    setPeriod('custom')
    void loadDashboard('custom', start, end).catch(() => {})
  }

  return (
    <section className="admin-dashboard-page">
      <header className="admin-dashboard-header">
        <div className="admin-dashboard-page-heading"><h2>Dashboard</h2><p>Welcome back! Here's what's happening with your store.</p></div>
        <DateRangePicker from={from} to={to} onSelectRange={applyDateRange} />
      </header>
      <div className="admin-dashboard-kpis">
        <KpiCard color="golden" currency growth={revenueGrowth} index={0} label="Total Revenue" value={data.revenue?.total} />
        <KpiCard color="blue" growth={ordersGrowth} index={1} label="Total Orders" value={data.orders?.total} />
        <KpiCard color="green" growth={productsGrowth} index={2} label="Products Sold" value={data.productsSold?.total} />
        <KpiCard color="purple" growth={productsGrowth} index={3} label="Overall Growth" overall value={productsGrowth} />
      </div>
      <div className="admin-dashboard-grid">
        <article className="admin-feature-card admin-revenue-card">
          <div className="admin-dashboard-card-header"><div><h3>Revenue Overview</h3><p>{periodText}</p></div><div aria-label="Dashboard period" className="admin-period-tabs">{['weekly', 'monthly'].map((item) => <button aria-pressed={period === item} className={period === item ? 'active' : ''} key={item} onClick={() => choosePeriod(item)} type="button">{item === 'weekly' ? 'Weekly' : 'Monthly'}</button>)}</div></div>
      {loading ? <output className="admin-dashboard-empty">Loading dashboard...</output> : <RevenueChart charts={charts} granularity={periodGranularity} period={period} />}
        </article>
        <article className="admin-feature-card admin-category-card">
          <h3>Sales by Category</h3>
          {loading ? <output className="admin-dashboard-empty">Loading categories...</output> : <CategoryChart categories={data.salesByCategory} />}
        </article>
        <article className="admin-feature-card admin-sellers-card">
          <div className="admin-dashboard-card-header"><h3><span aria-hidden="true">♜</span> Top Sellers</h3><Link className="admin-feature-link" to="/admin/products">All Products <span aria-hidden="true">→</span></Link></div>
          {loading ? <output className="admin-dashboard-empty">Loading top sellers...</output> : topSellers.length ? <div className="admin-top-sellers">{topSellers.map((seller, index) => <Link className="admin-top-seller" key={seller.productId} to={`/admin/products/edit/${seller.productId}`}><b>#{index + 1}</b><strong>{seller.label || 'Unnamed product'}</strong><small>{seller.category || '—'}</small><span className="admin-seller-likes">♥ {formatNumber(seller.likesCount)}</span><span className="admin-seller-sales">{formatNumber(seller.salesValue)} sold</span></Link>)}</div> : <p className="admin-dashboard-empty">No sales data found</p>}
        </article>
        <article className="admin-dashboard-viewers"><span aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8m-8 3a3 3 0 1 1 0-6 3 3 0 0 1 0 6" /></svg></span><div className="admin-kpi-label">Unique Viewers</div><div className="admin-kpi-value">{loading ? '0' : formatNumber(data.uniqueViewers)}</div><p>Total audience reach</p></article>
      </div>
    </section>
  )
}
