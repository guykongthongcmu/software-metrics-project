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

  it('rejects control characters, encoded or not, and very long values', () => {
    for (const value of ['/%09/evil.com', '/\t/evil.com', '/%0a/evil.com', '/\n/evil.com', '/%00x', '/\u0000x', '/%5Cevil.com', '/%zz']) {
      expect(safeNextPath(value)).toBe('')
    }
    expect(safeNextPath(`/${'a'.repeat(2000)}`)).toBe('')
    expect(safeNextPath(`/${'a'.repeat(1999)}`)).not.toBe('')
  })
})

describe('loginPath', () => {
  it('carries the current page, including its query, as next', () => {
    vi.stubGlobal('window', { location: { pathname: '/products/14', search: '?color=Beige' } })
    expect(loginPath()).toBe('/login?next=%2Fproducts%2F14%3Fcolor%3DBeige')
  })

  it('stays plain on the home page', () => {
    vi.stubGlobal('window', { location: { pathname: '/', search: '' } })
    expect(loginPath()).toBe('/login')
  })

  it('keeps the next value when the login page is already open', () => {
    vi.stubGlobal('window', { location: { pathname: '/login', search: '?next=%2Fcheckout' } })
    expect(loginPath()).toBe('/login?next=%2Fcheckout')
  })
})
