import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiClient, apiFetch } from '../../lib/apiClient.js'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function response({ ok = true, status = 200, contentType = 'application/json', body = { data: true } } = {}) {
  return {
    ok,
    status,
    headers: { get: vi.fn(() => contentType) },
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(body),
  }
}

describe('apiClient', () => {
  it('sends JSON requests with credentials and parses JSON responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response())
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiClient.post('/items', { name: 'shirt' }, { headers: { 'X-Request': 'yes' } }))
      .resolves.toEqual({ data: true })
    expect(fetchMock).toHaveBeenCalledWith('/api/items', expect.objectContaining({
      method: 'POST', credentials: 'include', body: JSON.stringify({ name: 'shirt' }),
      headers: { 'Content-Type': 'application/json', 'X-Request': 'yes' },
    }))
  })

  it('supports GET, PUT, PATCH, DELETE and FormData requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response())
    vi.stubGlobal('fetch', fetchMock)
    const form = new FormData()

    await apiClient.get('/items')
    await apiClient.put('/items/1', form)
    await apiClient.patch('/orders/1', { shippingAddressSnapshot: { province: 'Bangkok' } })
    await apiClient.delete('/items/1')

    expect(fetchMock.mock.calls.map(([url, options]) => [url, options.method])).toEqual([
      ['/api/items', 'GET'], ['/api/items/1', 'PUT'], ['/api/orders/1', 'PATCH'], ['/api/items/1', 'DELETE'],
    ])
    expect(fetchMock.mock.calls[1][1].body).toBe(form)
    expect(fetchMock.mock.calls[1][1].headers).toEqual({})
    expect(fetchMock.mock.calls[2][1].body).toBe(JSON.stringify({ shippingAddressSnapshot: { province: 'Bangkok' } }))
    expect(fetchMock.mock.calls[2][1].headers).toEqual({ 'Content-Type': 'application/json' })
  })

  it('parses text, tolerates invalid response bodies, and reports API errors', async () => {
    const textResponse = response({ contentType: 'text/plain', body: 'hello' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(textResponse).mockResolvedValueOnce({
      ...response({ ok: false, status: 503, contentType: 'application/json' }),
      json: vi.fn().mockRejectedValue(new Error('invalid json')),
      text: vi.fn().mockRejectedValue(new Error('invalid text')),
    }))
    await expect(apiFetch('/status')).resolves.toBe('hello')
    await expect(apiFetch('/broken')).rejects.toMatchObject({
      name: 'ApiError', status: 503, message: 'Request failed with status 503', payload: null,
    })
    expect(new ApiError('nope', { code: 'E', payload: { x: 1 } })).toMatchObject({ name: 'ApiError', code: 'E', payload: { x: 1 } })
  })

  it('uses an empty string when a non-JSON response body cannot be read', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ...response({ contentType: 'text/plain' }),
      text: vi.fn().mockRejectedValue(new Error('body unavailable')),
    }))
    await expect(apiFetch('/empty')).resolves.toBe('')
  })

  it('uses a server message and dispatches refresh after cart and favorites mutations', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ ok: false, status: 409, body: { message: 'Conflict', code: 'DUPLICATE' } }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(apiFetch('/items')).rejects.toMatchObject({ message: 'Conflict', code: 'DUPLICATE', payload: { message: 'Conflict', code: 'DUPLICATE' } })

    fetchMock.mockResolvedValue(response())
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    await apiClient.post('/client/cart/items', { id: 1 })
    await apiClient.delete('/client/favorites/1')
    await apiClient.put('/client/cart?lang=EN', {})
    await apiFetch('/client/cart', { method: 'PATCH' })
    expect(dispatchSpy).toHaveBeenCalledTimes(4)
    expect(dispatchSpy.mock.calls.map(([event]) => event.type)).toEqual(Array(4).fill('storefront:refresh-header'))
  })

  it('does not redirect a 401 when disabled', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ok: false, status: 401, body: { message: 'Unauthorized' } })))
    await expect(apiFetch('/private', { redirectOn401: false })).rejects.toBeInstanceOf(ApiError)
  })

  it('does not dispatch a header refresh for unrelated or read requests', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response()))
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    await apiFetch('/client/products', { method: 'POST', body: '{}' })
    await apiFetch('/client/cart', { method: 'GET' })
    expect(dispatchSpy).not.toHaveBeenCalled()
  })

  it('uses an empty content type when the header is missing and preserves FormData post bodies', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ...response({ contentType: '' }),
      headers: { get: vi.fn(() => null) },
      text: vi.fn().mockResolvedValue('plain response'),
    })
    vi.stubGlobal('fetch', fetchMock)
    const form = new FormData()
    form.append('name', 'member')
    await expect(apiFetch('/plain')).resolves.toBe('plain response')
    await apiClient.post('/upload', form)
    expect(fetchMock.mock.calls[1][1].body).toBe(form)
    expect(fetchMock.mock.calls[1][1].headers).toEqual({})
  })

  it('redirects unauthorized requests to the matching login page only when needed', async () => {
    const assign = vi.fn()
    const fetchMock = vi.fn().mockResolvedValue(response({ ok: false, status: 401, body: { message: 'Unauthorized' } }))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('window', { location: { pathname: '/admin/orders', assign } })
    await expect(apiFetch('/admin/private')).rejects.toBeInstanceOf(ApiError)
    expect(assign).toHaveBeenCalledWith('/admin/login')

    window.location.pathname = '/account/profile'
    await expect(apiFetch('/private')).rejects.toBeInstanceOf(ApiError)
    expect(assign).toHaveBeenLastCalledWith('/login?next=%2Faccount%2Fprofile')

    window.location.pathname = '/login'
    const callsBeforeLoginPage = assign.mock.calls.length
    await expect(apiFetch('/private')).rejects.toBeInstanceOf(ApiError)
    expect(assign).toHaveBeenCalledTimes(callsBeforeLoginPage)
  })

  it('marks an expired admin session before redirecting to the admin login page', async () => {
    const assign = vi.fn()
    const setItem = vi.fn()
    vi.stubGlobal('window', {
      location: { pathname: '/admin/products', assign },
      sessionStorage: { setItem },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ok: false, status: 401 })))

    await expect(apiFetch('/admin/products')).rejects.toBeInstanceOf(ApiError)

    expect(setItem).toHaveBeenCalledWith('adminSessionExpired', 'true')
    expect(assign).toHaveBeenCalledWith('/admin/login')
  })

  it('still redirects when session storage is unavailable', async () => {
    const assign = vi.fn()
    vi.stubGlobal('window', {
      location: { pathname: '/admin/orders', assign },
      sessionStorage: { setItem: vi.fn(() => { throw new Error('storage disabled') }) },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ok: false, status: 401 })))

    await expect(apiFetch('/admin/orders')).rejects.toBeInstanceOf(ApiError)

    expect(assign).toHaveBeenCalledWith('/admin/login')
  })
})
