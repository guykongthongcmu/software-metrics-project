import { afterEach, describe, expect, it, vi } from 'vitest'
import { loginPath, safeNextPath } from '../../lib/loginRedirect.js'

afterEach(() => { vi.unstubAllGlobals() })

describe('safeNextPath', () => {
  it('keeps local paths and drops anything else', () => {
    expect(safeNextPath('/favorites')).toBe('/favorites')
    expect(safeNextPath('/products/14?color=Beige')).toBe('/products/14?color=Beige')
    for (const value of ['//example.com', '/\\example.com', 'https://example.com', 'favorites', '/login', '/login?next=%2Fcart', null, undefined]) {
      expect(safeNextPath(value)).toBe('')
    }
  })
})

describe('loginPath', () => {
  it('carries the current page, including its query, as next', () => {
    vi.stubGlobal('window', { location: { pathname: '/products/14', search: '?color=Beige' } })
    expect(loginPath()).toBe('/login?next=%2Fproducts%2F14%3Fcolor%3DBeige')
  })

  it('stays plain on the home page and the login page', () => {
    vi.stubGlobal('window', { location: { pathname: '/', search: '' } })
    expect(loginPath()).toBe('/login')
    vi.stubGlobal('window', { location: { pathname: '/login', search: '' } })
    expect(loginPath()).toBe('/login')
  })
})
