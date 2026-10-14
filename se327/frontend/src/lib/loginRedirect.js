export function safeNextPath(value) {
  if (typeof value !== 'string' || value.length > 2000 || !value.startsWith('/') || value.startsWith('//')) return ''
  // tabs, newlines and backslashes are stripped or rewritten by the browser, which can turn /<tab>/host into //host
  let decoded = value
  try { decoded = decodeURIComponent(value) } catch { return '' }
  if (/[\u0000-\u001f\u007f\\]/.test(value) || /[\u0000-\u001f\u007f\\]/.test(decoded)) return ''
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
