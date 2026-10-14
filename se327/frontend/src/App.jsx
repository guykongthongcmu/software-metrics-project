import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { accountRoutes } from './pages/account/routes.js'
import { adminRoutes } from './pages/admin/routes.js'
import { storefrontRoutes } from './pages/webstore/routes.js'
import StorefrontLayout from './pages/webstore/StorefrontLayout.jsx'
import AboutPage from './pages/webstore/AboutPage.jsx'
import ContactPage from './pages/webstore/ContactPage.jsx'
import LoginPage from './pages/account/LoginPage.jsx'
import SignupPage from './pages/account/SignupPage.jsx'
import SignupInfoPage from './pages/account/SignupInfoPage.jsx'
import SignupConfirmPage from './pages/account/SignupConfirmPage.jsx'
import ForgotPasswordPage from './pages/account/ForgotPasswordPage.jsx'
import ForgotPasswordSuccessPage from './pages/account/ForgotPasswordSuccessPage.jsx'
import ResetPasswordPage from './pages/account/ResetPasswordPage.jsx'
import ProfilePage from './pages/account/ProfilePage.jsx'
import HomePage from './pages/webstore/HomePage.jsx'
import AllProductsPage from './pages/webstore/AllProductsPage.jsx'
import ProductDetailPage from './pages/webstore/ProductDetailPage.jsx'
import SearchPage from './pages/webstore/SearchPage.jsx'
import CartPage from './pages/webstore/CartPage.jsx'
import AdminLayout from './pages/admin/AdminLayout.jsx'
import AdminLoginPage from './pages/admin/AdminLoginPage.jsx'
import AdminDashboardPage from './pages/admin/AdminDashboardPage.jsx'
import CategoryLandingPage from './pages/webstore/CategoryLandingPage.jsx'
import CheckoutPage from './pages/webstore/CheckoutPage.jsx'
import CheckoutSuccessPage from './pages/webstore/CheckoutSuccessPage.jsx'
import FavoritesPage from './pages/webstore/FavoritesPage.jsx'
import AdminOrdersPage from './pages/admin/AdminOrdersPage.jsx'
import AdminOrderDetailPage from './pages/admin/AdminOrderDetailPage.jsx'
import AdminCampaignBuilderPage from './pages/admin/AdminCampaignBuilderPage.jsx'

function getAccountPage(route) {
  switch (route.path) {
    case '/login': return <LoginPage />
    case '/auth/signup': return <SignupPage />
    case '/auth/signup-info': return <SignupInfoPage />
    case '/auth/signup-confirm': return <SignupConfirmPage />
    case '/forgot-password': return <ForgotPasswordPage />
    case '/forgot-password-success': return <ForgotPasswordSuccessPage />
    case '/auth/reset-password': return <ResetPasswordPage />
    case '/account/profile': return <ProfilePage />
    default: return <StorefrontPlaceholder title={route.title} />
  }
}
function StorefrontPlaceholder({ title }) {
  const location = useLocation()
  const categoryRoute = storefrontRoutes.find((entry) => entry.path === location.pathname)
  const banner = categoryRoute?.banner || (location.pathname === '/' ? '/images/hero_image.jpg' : null)
  return (
    <main className="mx-auto w-full max-w-[var(--layout-width)] px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      {banner && <div className="mb-8 aspect-[16/7] overflow-hidden bg-accent-soft sm:aspect-[21/7]"><img className="h-full w-full object-cover" src={banner} alt={`${title} collection`} /></div>}
      <section className="py-2"><p className="text-sm text-muted">{location.pathname}</p><h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">{title}</h1><p className="mt-3 max-w-xl text-muted">This page is connected to the React route map and ready for its feature implementation.</p><Link className="mt-8 inline-flex border-b border-ink pb-1 text-sm" to="/">Return to storefront</Link></section>
      {location.pathname === '/' && <section aria-label="Shop by category" className="mt-12"><div className="mb-5 flex items-end justify-between gap-4"><h2 className="font-display text-2xl">Shop by category</h2><span className="text-xs text-muted">Explore the collection</span></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{storefrontRoutes.filter((entry) => entry.category).map((entry) => <Link className="group overflow-hidden rounded-[var(--radius-control)] bg-panel" key={entry.path} to={entry.path}><div className="aspect-[4/5] overflow-hidden bg-accent-soft"><img className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" src={entry.tile} alt="" /></div><span className="block px-3 py-3 font-medium">{entry.title}</span></Link>)}</div></section>}
    </main>
  )
}

function AdminPlaceholder({ title }) {
  const location = useLocation()
  return <section className="rounded-[var(--radius-card)] border border-line bg-panel p-6 shadow-panel backdrop-blur-xl sm:p-8"><p className="text-sm text-muted">{location.pathname}</p><h2 className="mt-2 font-admin-display text-3xl">{title}</h2></section>
}

function NotFoundPage() {
  return <StorefrontPlaceholder title="Page not found" />
}

function getStorefrontPage(route) {
  if (route.path === '/login') return <LoginPage />
  if (route.path === '/') return <HomePage />
  if (route.path === '/products') return <AllProductsPage />
  if (route.path === '/about') return <AboutPage />
  if (route.path === '/contact') return <ContactPage />
  if (route.path === '/search') return <SearchPage />
  if (route.path === '/products/:id') return <ProductDetailPage />
  if (route.path === '/cart') return <CartPage />
  if (route.category) return <CategoryLandingPage category={route} />
  if (route.path === '/checkout') return <CheckoutPage />
  if (route.path === '/checkout/success') return <CheckoutSuccessPage />
  if (route.path === '/favorites') return <FavoritesPage />
  return <StorefrontPlaceholder title={route.title} />
}

export default function App() {
  return (
    <Routes>
      <Route element={<StorefrontLayout />}>
        {storefrontRoutes.map((route) => <Route key={route.path} path={route.path} element={getStorefrontPage(route)} />)}
        {accountRoutes.map((route) => <Route key={route.path} path={route.path} element={getAccountPage(route)} />)}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route element={<AdminLayout />}>
<Route path="/admin/dashboard" element={<AdminDashboardPage />} />
<Route path="/admin/orders" element={<AdminOrdersPage />} />
<Route path="/admin/orders/:id" element={<AdminOrderDetailPage />} />
<Route path="/admin/campaigns/builder" element={<AdminCampaignBuilderPage />} />

{adminRoutes
  .filter((route) =>
    ![
      '/admin/login',
      '/admin/dashboard',
      '/admin/orders',
      '/admin/orders/:id',
      '/admin/campaigns/builder',
    ].includes(route.path)
  )
  .map((route) => (
    <Route
      key={route.path}
      path={route.path}
      element={<AdminPlaceholder title={route.title} />}
    />
  ))}
      </Route>
      <Route path="/profile" element={<Navigate to="/account/profile" replace />} />
      <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="/dashboard" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="/orders" element={<Navigate to="/admin/orders" replace />} />
    </Routes>
  )
}
