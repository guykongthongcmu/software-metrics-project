import { withSelectedLanguage } from './language.js'
import { loginPath } from './loginRedirect.js'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export class ApiError extends Error {
  /** @param {string} message @param {{status?: number, code?: string, payload?: any}} [details] */
  constructor(message, { status, code, payload } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.payload = payload
  }
}

export function isUnauthorizedError(error) {
  return error?.status === 401
}

async function readPayload(response) {
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('json')) return response.json().catch(() => null)
  return response.text().catch(() => '')
}

function redirectForUnauthorized(status, redirectOn401) {
  if (status !== 401 || !redirectOn401 || typeof window === 'undefined') return
  const isAdminRoute = window.location.pathname.startsWith('/admin/')
  const loginUrl = isAdminRoute ? '/admin/login' : loginPath()
  if (window.location.pathname === (isAdminRoute ? '/admin/login' : '/login')) return
  if (isAdminRoute) {
    try {
      window.sessionStorage?.setItem('adminSessionExpired', 'true')
    } catch {
      // The redirect still works if browser storage is unavailable.
    }
  }
  window.location.assign(loginUrl)
}

function shouldRefreshHeader(method, path) {
  return Boolean(method && method !== 'GET' && /\/client\/(cart|favorites)(\/|\?|$)/.test(path))
}

function requestHeaders(options) {
  const isJsonBody = options.body && !(options.body instanceof FormData)
  return {
    ...(isJsonBody ? { 'Content-Type': 'application/json' } : {}),
    ...options.headers,
  }
}

/** @param {string} path @param {RequestInit & {redirectOn401?: boolean}} [options] */
export async function apiFetch(path, options = {}) {
  const { redirectOn401 = true, ...requestOptions } = options
  const response = await fetch(`${API_BASE_URL}${withSelectedLanguage(path)}`, {
    ...requestOptions,
    credentials: 'include',
    headers: requestHeaders(requestOptions),
  })
  const payload = await readPayload(response)

  if (!response.ok) {
    const error = new ApiError(
      payload?.message || `Request failed with status ${response.status}`,
      { status: response.status, code: payload?.code, payload },
    )

    redirectForUnauthorized(response.status, redirectOn401)

    throw error
  }

  if (shouldRefreshHeader(options.method, path)) {
    window.dispatchEvent(new CustomEvent('storefront:refresh-header'))
  }

  return payload
}

export const apiClient = {
  get: (path, options) => apiFetch(path, { ...options, method: 'GET' }),
  post: (path, body, options) => apiFetch(path, {
    ...options,
    method: 'POST',
    body: body instanceof FormData ? body : JSON.stringify(body),
  }),
  put: (path, body, options) => apiFetch(path, {
    ...options,
    method: 'PUT',
    body: body instanceof FormData ? body : JSON.stringify(body),
  }),
  patch: (path, body, options) => apiFetch(path, {
    ...options,
    method: 'PATCH',
    body: body instanceof FormData ? body : JSON.stringify(body),
  }),
  delete: (path, options) => apiFetch(path, { ...options, method: 'DELETE' }),
}
