import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { accountRoutes } from './pages/account/routes.js'
import { adminRoutes } from './pages/admin/routes.js'
import { storefrontRoutes } from './pages/webstore/routes.js'

function PagePlaceholder({ title, area }) {
  const location = useLocation()
  const isAdmin = area === 'admin'
  const route = [...storefrontRoutes, ...accountRoutes, ...adminRoutes]
    .find((entry) => entry.path === location.pathname)
  const categoryRoute = storefrontRoutes.find((entry) => entry.path === location.pathname)
  const banner = categoryRoute?.banner || (location.pathname === '/' ? '/images/hero_image.jpg' : null)

  return (
    <div data-theme={isAdmin ? 'admin' : 'storefront'} className="min-h-screen bg-canvas text-ink">
      <header className={isAdmin
        ? 'border-b border-line bg-panel shadow-panel backdrop-blur-xl'
        : 'border-b border-line bg-panel'}>
        <div className="mx-auto flex max-w-[var(--layout-width)] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link className="shrink-0" to="/" aria-label="Core and Co home">
            <img className="h-12 w-12 object-contain" src="/images/logo.png" alt="Core & Co" />
          </Link>
          <nav aria-label={isAdmin ? 'Admin navigation' : 'Store categories'} className="flex flex-wrap justify-end gap-x-4 gap-y-2 sm:gap-x-6">
            {isAdmin ? (
              <span className="font-admin-ui text-xs font-semibold uppercase tracking-widest text-muted">Administration</span>
            ) : (
              <>
                <Link className="text-sm hover:text-accent" to="/">Home</Link>
                <Link className="text-sm hover:text-accent" to="/products">Products</Link>
                {storefrontRoutes.filter((entry) => entry.category).map((entry) => (
                  <Link className="text-sm hover:text-accent" key={entry.path} to={entry.path}>{entry.title}</Link>
                ))}
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[var(--layout-width)] px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        {banner && (
          <div className="mb-8 aspect-[16/7] overflow-hidden rounded-[var(--radius-card)] bg-accent-soft sm:aspect-[21/7]">
            <img className="h-full w-full object-cover" src={banner} alt={`${title} collection`} />
          </div>
        )}
        <section className={isAdmin
          ? 'rounded-[var(--radius-card)] border border-line bg-panel p-5 shadow-panel backdrop-blur-xl sm:p-8'
          : 'py-2'}>
          <p className="text-sm text-muted">{location.pathname}</p>
          <h1 className={`mt-2 text-3xl font-semibold sm:text-4xl ${isAdmin ? 'font-admin-display' : 'font-display'}`}>{title}</h1>
          <p className="mt-3 max-w-xl text-muted">
          This page is connected to the React route map and ready for its feature implementation.
          </p>
          <Link className="mt-8 inline-flex border-b border-ink pb-1 text-sm" to="/">
            Return to storefront
          </Link>
        </section>
        {!isAdmin && !route?.category && (
          <section aria-label="Shop by category" className="mt-12">
            <div className="mb-5 flex items-end justify-between gap-4">
              <h2 className="font-display text-2xl">Shop by category</h2>
              <span className="text-xs text-muted">Explore the collection</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {storefrontRoutes.filter((entry) => entry.category).map((entry) => (
                <Link className="group overflow-hidden rounded-[var(--radius-control)] bg-panel" key={entry.path} to={entry.path}>
                  <div className="aspect-[4/5] overflow-hidden bg-accent-soft">
                    <img className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" src={entry.tile} alt="" />
                  </div>
                  <span className="block px-3 py-3 font-medium">{entry.title}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

function NotFoundPage() {
  return <PagePlaceholder title="Page not found" area="storefront" />
}

function routeElement(route, area) {
  const Component = route.component || (() => <PagePlaceholder title={route.title} area={area} />)
  return <Route key={route.path} path={route.path} element={<Component />} />
}

export default function App() {
  return (
    <Routes>
      {storefrontRoutes.map((route) => routeElement(route, 'storefront'))}
      {accountRoutes.map((route) => routeElement(route, 'account'))}
      {adminRoutes.map((route) => routeElement(route, 'admin'))}
      <Route path="/profile" element={<Navigate to="/account/profile" replace />} />
      <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="/dashboard" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="/orders" element={<Navigate to="/admin/orders" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
