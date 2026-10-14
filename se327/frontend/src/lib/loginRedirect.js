export function safeNextPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return ''
  return value === '/login' || value.startsWith('/login?') ? '' : value
}

/** Login page URL that sends the visitor back to the page they are on after signing in. */
export function loginPath() {
  if (typeof window === 'undefined') return '/login'
  // already redirected by an earlier request, keep its next value
  if (window.location.pathname === '/login') return `/login${window.location.search || ''}`
  const next = safeNextPath(window.location.pathname + (window.location.search || ''))
  return next && next !== '/' ? `/login?next=${encodeURIComponent(next)}` : '/login'
}
