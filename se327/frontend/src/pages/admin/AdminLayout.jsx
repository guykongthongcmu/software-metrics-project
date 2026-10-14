import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'
import { adminRoutes } from './routes.js'
import './admin.css'

const navigation = [
  { label: 'Dashboard', path: '/admin/dashboard', icon: 'dashboard', match: (path) => path === '/admin/dashboard' },
  { label: 'Orders', path: '/admin/orders', icon: 'orders', match: (path) => path.startsWith('/admin/orders') },
  { label: 'Products', path: '/admin/products', icon: 'products', match: (path) => path.startsWith('/admin/products') },
  { label: 'Categories', path: '/admin/categories', icon: 'categories', match: (path) => path.startsWith('/admin/categories') },
  { label: 'Campaign Builder', path: '/admin/campaigns/builder', icon: 'campaigns', match: (path) => path === '/admin/campaigns/builder' },
]

const searchableLinks = navigation.filter((item) => item.label !== 'Categories')

function currentPageTitle(pathname) {
  return adminRoutes.find((route) => {
    const routePattern = route.path.replace(/:[^/]+/g, '[^/]+')
    return new RegExp(`^${routePattern}$`).test(pathname)
  })?.title || 'Admin Panel'
}

function legacyDocumentTitle(pathname) {
  if (pathname === '/admin/dashboard') return 'Dashboard'
  if (pathname === '/admin/orders') return 'Orders'
  if (/^\/admin\/orders\/\d+$/.test(pathname)) return `Order ${pathname.split('/').at(-1)}`
  if (pathname === '/admin/products') return 'Products'
  if (pathname === '/admin/products/create') return 'Create Product'
  if (/^\/admin\/products\/edit\/[^/]+$/.test(pathname)) return 'Edit Product'
  if (pathname === '/admin/categories') return 'Category Management'
  if (pathname === '/admin/campaigns/builder') return 'Campaign Builder'
  return null
}

function AdminIcon({ name }) {
  const iconPaths = {
    dashboard: <path d="M6 1H1v14h5zm9 0h-5v5h5zm0 9v5h-5v-5zM0 1a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H1a1 1 0 0 1-1-1zm9 0a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1zm1 8a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1z" />,
    orders: <path d="M0 1.5A.5.5 0 0 1 .5 1H2a.5.5 0 0 1 .485.379L2.89 3H14.5a.5.5 0 0 1 .491.592l-1.5 8A.5.5 0 0 1 13 12H4a.5.5 0 0 1-.491-.408L2.01 3.607 1.61 2H.5a.5.5 0 0 1-.5-.5M3.102 4l1.313 7h8.17l1.313-7zM5 12a2 2 0 1 0 0 4 2 2 0 0 0 0-4m7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4m-7 1a1 1 0 1 1 0 2 1 1 0 0 1 0-2m7 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2" />,
    products: <path d="M8 1a2.5 2.5 0 0 1 2.5 2.5V4h-5v-.5A2.5 2.5 0 0 1 8 1m3.5 3v-.5a3.5 3.5 0 1 0-7 0V4H1v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4zM2 5h12v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" />,
    categories: <><path d="M3 2v4.586l7 7L14.586 9l-7-7zM2 2a1 1 0 0 1 1-1h4.586a1 1 0 0 1 .707.293l7 7a1 1 0 0 1 0 1.414l-4.586 4.586a1 1 0 0 1-1.414 0l-7-7A1 1 0 0 1 2 6.586z" /><path d="M5.5 5a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1m0 1a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M1 7.086a1 1 0 0 0 .293.707L8.75 15.25l-.043.043a1 1 0 0 1-1.414 0l-7-7A1 1 0 0 1 0 7.586V3a1 1 0 0 1 1-1z" /></>,
    campaigns: <path d="M13 2.5a1.5 1.5 0 0 1 3 0v11a1.5 1.5 0 0 1-3 0v-.214c-2.162-1.241-4.49-1.843-6.912-2.083l.405 2.712A1 1 0 0 1 5.51 15.1h-.548a1 1 0 0 1-.916-.599l-1.85-3.49-.202-.003A2.014 2.014 0 0 1 0 9V7a2.02 2.02 0 0 1 1.992-2.013 75 75 0 0 0 2.483-.075c3.043-.154 6.148-.849 8.525-2.199zm1 0v11a.5.5 0 0 0 1 0v-11a.5.5 0 0 0-1 0m-1 1.35c-2.344 1.205-5.209 1.842-8 2.033v4.233q.27.015.537.036c2.568.189 5.093.744 7.463 1.993zm-9 6.215v-4.13a95 95 0 0 1-1.992.052A1.02 1.02 0 0 0 1 7v2c0 .55.448 1.002 1.006 1.009A61 61 0 0 1 4 10.065m-.657.975 1.609 3.037.01.024h.548l-.002-.014-.443-2.966a68 68 0 0 0-1.722-.082z" />,
    logout: <><path fillRule="evenodd" d="M6 12.5a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-8a.5.5 0 0 0-.5.5v2a.5.5 0 0 1-1 0v-2A1.5 1.5 0 0 1 6.5 2h8A1.5 1.5 0 0 1 16 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 5 12.5v-2a.5.5 0 0 1 1 0z" /><path fillRule="evenodd" d="M.146 8.354a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L1.707 7.5H10.5a.5.5 0 0 1 0 1H1.707l2.147 2.146a.5.5 0 0 1-.708.708z" /></>,
  }
  return <svg aria-hidden="true" className="admin-nav-svg" viewBox="0 0 16 16">{iconPaths[name]}</svg>
}

function AdminToast({ toast, onDismiss }) {
  if (!toast) return null
  let icon = 'i'
  if (toast.type === 'success') icon = '✓'
  else if (toast.type === 'error' || toast.type === 'danger') icon = '!'
  return (
    <div className="admin-toast-stack">
      <output aria-live="polite" className={`admin-toast admin-toast-${toast.type || 'success'}`}>
        <span aria-hidden="true" className="admin-toast-icon">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="admin-toast-title">{toast.title}</p>
          <p className="admin-toast-message">{toast.message}</p>
        </div>
        <button aria-label="Close notification" className="admin-toast-close" onClick={onDismiss} type="button">×</button>
      </output>
    </div>
  )
}

export default function AdminLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.localStorage.getItem('sidebarCollapsed') === 'true')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const [logoutBusy, setLogoutBusy] = useState(false)
  const adminName = window.sessionStorage.getItem('adminDisplayName') || 'Admin'
  const pageTitle = currentPageTitle(location.pathname)
  const matches = searchableLinks.filter((item) => item.label.toLowerCase().includes(searchTerm.trim().toLowerCase()))

  useEffect(() => {
    const title = legacyDocumentTitle(location.pathname)
    document.title = title ? `${title} | Admin Panel` : 'Admin Panel'
  }, [location.pathname])

  useEffect(() => {
    const showToast = (title, message, type = 'success') => {
      setToast({ id: Date.now(), title, message, type })
    }
    const onAdminToast = (event) => {
      setToast({ id: Date.now(), ...event.detail })
    }
    window.showToast = showToast
    window.addEventListener('admin:toast', onAdminToast)
    return () => {
      window.removeEventListener('admin:toast', onAdminToast)
      if (window.showToast === showToast) delete window.showToast
    }
  }, [])

  useEffect(() => {
    if (!toast) return undefined
    const timeout = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(timeout)
  }, [toast])

  function toggleSidebar() {
    if (window.innerWidth < 992) {
      setMobileOpen((open) => !open)
      return
    }
    setSidebarCollapsed((collapsed) => {
      const next = !collapsed
      window.localStorage.setItem('sidebarCollapsed', String(next))
      return next
    })
  }

  async function logout() {
    if (logoutBusy) return
    setLogoutBusy(true)
    try {
      await apiClient.post('/auth/logout', {}, { redirectOn401: false })
      window.localStorage.clear()
      window.sessionStorage.clear()
      await navigate('/admin/login', { replace: true })
    } catch (error) {
      if (error?.status === 401) {
        window.localStorage.clear()
        window.sessionStorage.clear()
        await navigate('/admin/login', { replace: true })
        return
      }
      setToast({ id: Date.now(), title: 'Logout Failed', message: error?.message || 'Unable to logout. Please try again.', type: 'error' })
    } finally {
      setLogoutBusy(false)
    }
  }

  return (
    <div className="admin-layout" data-theme="admin">
      <div aria-hidden="true" className="admin-liquid-background">
        <span className="admin-liquid-orb admin-orb-one" />
        <span className="admin-liquid-orb admin-orb-two" />
        <span className="admin-liquid-orb admin-orb-three" />
        <span className="admin-liquid-orb admin-orb-four" />
        <span className="admin-liquid-orb admin-orb-five" />
      </div>

      {mobileOpen && <button aria-label="Close navigation" className="admin-mobile-overlay" onClick={() => setMobileOpen(false)} type="button" />}
      <aside className={`admin-sidebar ${sidebarCollapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'is-open' : ''}`}>
        <div className="admin-sidebar-inner">
          <div className="admin-sidebar-brand">
            <div className="admin-brand-avatar">A</div>
            <div className="admin-brand-info"><strong>{adminName}</strong><small>Administrator</small></div>
          </div>
          <nav aria-label="Admin navigation" className="admin-sidebar-nav">
            {navigation.map((item) => {
              const active = item.match(location.pathname)
              return (
                <NavLink aria-current={active ? 'page' : undefined} className={`admin-sidebar-link ${active ? 'active' : ''}`} key={item.path} onClick={() => setMobileOpen(false)} to={item.path}>
                  <span className="admin-nav-icon"><AdminIcon name={item.icon} /></span><span>{item.label}</span>
                </NavLink>
              )
            })}
          </nav>
          <div className="admin-sidebar-footer">
            <button className="admin-sidebar-link admin-logout-link" disabled={logoutBusy} onClick={() => { void logout() }} type="button">
              <span className="admin-nav-icon"><AdminIcon name="logout" /></span><span>{logoutBusy ? 'Logging out...' : 'Log Out'}</span>
            </button>
          </div>
        </div>
      </aside>

      <header className={`admin-topbar ${sidebarCollapsed ? 'is-collapsed' : ''}`}>
        <div className="admin-topbar-left">
          <button aria-label={window.innerWidth < 992 ? 'Open navigation' : 'Toggle sidebar'} className="admin-toggle-button" onClick={toggleSidebar} type="button">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <h1 className="admin-breadcrumb">{pageTitle}</h1>
        </div>
        <div className="admin-topbar-right">
          <div className="admin-search-wrap" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setSearchOpen(false) }}>
            <svg aria-hidden="true" className="admin-search-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m16 16 4 4" /></svg>
            <input aria-label="Search pages" autoComplete="off" onChange={(event) => setSearchTerm(event.target.value)} onFocus={() => setSearchOpen(true)} placeholder="Search pages..." value={searchTerm} />
            {searchOpen && <div className="admin-search-dropdown">
              {matches.map((item) => <Link className="admin-search-result" key={item.path} onClick={() => { setSearchTerm(''); setSearchOpen(false) }} to={item.path}><span className="admin-search-result-icon"><AdminIcon name={item.icon} /></span>{item.label}</Link>)}
              {matches.length === 0 && <p className="admin-search-empty">No pages found</p>}
            </div>}
          </div>
        </div>
      </header>

      <main className={`admin-main ${sidebarCollapsed ? 'is-collapsed' : ''}`}>
        <div className="admin-content-wrapper"><Outlet /></div>
      </main>
      <AdminToast onDismiss={() => setToast(null)} toast={toast} />
    </div>
  )
}
