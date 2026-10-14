import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getLanguage, setLanguage, withSelectedLanguage } from '../../lib/language.js'

describe('language', () => {
  beforeEach(() => {
    window.localStorage.clear()
    setLanguage('EN')
  })
  afterEach(() => vi.restoreAllMocks())

  it('stores the selected language and announces the change', () => {
    const listener = vi.fn()
    window.addEventListener('storefront:language-changed', listener)
    setLanguage('TH')
    window.removeEventListener('storefront:language-changed', listener)

    expect(getLanguage()).toBe('TH')
    expect(window.localStorage.getItem('language')).toBe('TH')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0][0].detail).toEqual({ language: 'TH' })
  })

  it('ignores unknown languages and repeated selections', () => {
    const listener = vi.fn()
    window.addEventListener('storefront:language-changed', listener)
    setLanguage('FR')
    setLanguage('EN')
    window.removeEventListener('storefront:language-changed', listener)

    expect(getLanguage()).toBe('EN')
    expect(listener).not.toHaveBeenCalled()
  })

  it('keeps working when browser storage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    expect(() => setLanguage('TH')).not.toThrow()
    expect(getLanguage()).toBe('TH')
  })

  it('replaces lang on storefront paths only', () => {
    setLanguage('TH')
    expect(withSelectedLanguage('/client/products?page=1&lang=EN')).toBe('/client/products?page=1&lang=TH')
    expect(withSelectedLanguage('/client/products/5?lang=EN')).toBe('/client/products/5?lang=TH')
    expect(withSelectedLanguage('/client/categories?sort=category_name')).toBe('/client/categories?sort=category_name')
    expect(withSelectedLanguage('/admin/products?lang=EN')).toBe('/admin/products?lang=EN')
  })

  it('sets the html lang attribute', () => {
    setLanguage('TH')
    expect(document.documentElement.lang).toBe('th')
    setLanguage('EN')
    expect(document.documentElement.lang).toBe('en')
  })

  it('follows a language change made in another tab', () => {
    const listener = vi.fn()
    window.addEventListener('storefront:language-changed', listener)
    window.dispatchEvent(new StorageEvent('storage', { key: 'language', newValue: 'TH' }))
    window.dispatchEvent(new StorageEvent('storage', { key: 'language', newValue: 'TH' }))
    window.dispatchEvent(new StorageEvent('storage', { key: 'other', newValue: 'EN' }))
    window.dispatchEvent(new StorageEvent('storage', { key: 'language', newValue: 'FR' }))
    window.removeEventListener('storefront:language-changed', listener)

    expect(getLanguage()).toBe('TH')
    expect(document.documentElement.lang).toBe('th')
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
