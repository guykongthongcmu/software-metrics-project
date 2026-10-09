const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export class ApiError extends Error {
  constructor(message, { status, code, payload } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.payload = payload
  }
}

export async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...options.headers,
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

    if (response.status === 401 && typeof window !== 'undefined') {
      const loginPath = window.location.pathname.startsWith('/admin/')
        ? '/admin/login'
        : '/login'
      if (window.location.pathname !== loginPath) window.location.assign(loginPath)
    }

    throw error
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
  delete: (path, options) => apiFetch(path, { ...options, method: 'DELETE' }),
}