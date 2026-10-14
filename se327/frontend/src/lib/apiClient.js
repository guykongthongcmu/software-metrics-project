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

/** @param {string} path @param {RequestInit & {redirectOn401?: boolean}} [options] */
export async function apiFetch(path, options = {}) {
  const { redirectOn401 = true, ...requestOptions } = options
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...requestOptions,
    credentials: 'include',
    headers: {
      ...(requestOptions.body && !(requestOptions.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...requestOptions.headers,
    },
  })

  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => '')

  if (!response.ok) {
    const error = new ApiError(
      payload?.message || `Request failed with status ${response.status}`,
      { status: response.status, code: payload?.code, payload },
    )

    if (response.status === 401 && redirectOn401 && typeof window !== 'undefined') {
      const isAdminRoute = window.location.pathname.startsWith('/admin/')
      const loginPath = isAdminRoute
        ? '/admin/login'
        : '/login'
      if (window.location.pathname !== loginPath) {
        if (isAdminRoute) {
          try {
            window.sessionStorage?.setItem('adminSessionExpired', 'true')
          } catch {
            // The redirect still works if browser storage is unavailable.
          }
        }
        window.location.assign(loginPath)
      }
    }

    throw error
  }

  if (options.method && options.method !== 'GET' && /\/client\/(cart|favorites)(\/|\?|$)/.test(path)) {
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
