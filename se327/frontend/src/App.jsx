import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { accountRoutes } from './pages/account/routes.js'
import { adminRoutes } from './pages/admin/routes.js'
import { storefrontRoutes } from './pages/webstore/routes.js'

function PagePlaceholder({ title, area }) {
  const location = useLocation()
  const isAdmin = area === 'admin'

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link className="font-semibold tracking-wide" to="/">CORECO</Link>
          <span className="text-xs font-medium uppercase tracking-wider text-stone-500">
            {isAdmin ? 'Administration' : 'Storefront'}
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-14">
        <p className="text-sm text-stone-500">{location.pathname}</p>
        <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
        <p className="mt-3 max-w-xl text-stone-600">
          This page is connected to the React route map and ready for its feature implementation.
        </p>
        <Link className="mt-8 inline-flex border-b border-stone-900 pb-1 text-sm" to="/">
          Return to storefront
        </Link>
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
