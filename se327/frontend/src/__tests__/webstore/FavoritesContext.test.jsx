import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { FavoritesProvider, getMockFavoriteCount, readMockFavorites, useFavorites } from '../../pages/webstore/partials/FavoritesContext.jsx'

const KEY = 'core-co-mock-favorites'

afterEach(() => cleanup())
beforeEach(() => window.localStorage.clear())

function FavoritesProbe() {
  const { favoriteIds, toggleFavorite } = useFavorites()
  return (
    <div>
      <output>{[...favoriteIds].join(',')}</output>
      <button onClick={() => toggleFavorite(7)} type="button">Toggle seven</button>
      <button onClick={() => toggleFavorite('8')} type="button">Toggle eight</button>
    </div>
  )
}

describe('mock favorites storage', () => {
  it('reads numeric favorite ids and reports their count', () => {
    window.localStorage.setItem(KEY, JSON.stringify([1, '2', 'invalid']))

    expect([...readMockFavorites()]).toEqual([1, 2])
    expect(getMockFavoriteCount()).toBe(2)
  })

  it.each(['not json', '{"not":"an array"}', 'null'])('falls back to an empty set for invalid saved data: %s', (saved) => {
    window.localStorage.setItem(KEY, saved)

    expect(readMockFavorites().size).toBe(0)
  })

  it('falls back to an empty set when local storage cannot be read', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })

    expect(readMockFavorites().size).toBe(0)
    getItem.mockRestore()
  })

  it('adds and removes ids, persists state, and emits the updated count', () => {
    window.localStorage.setItem(KEY, JSON.stringify([8]))
    const listener = vi.fn()
    window.addEventListener('storefront:favorites-updated', listener)
    render(<FavoritesProvider><FavoritesProbe /></FavoritesProvider>)

    expect(screen.getByText('8').textContent).toBe('8')
    fireEvent.click(screen.getByRole('button', { name: 'Toggle seven' }))
    expect(screen.getByText('8,7').textContent).toBe('8,7')
    expect(JSON.parse(window.localStorage.getItem(KEY))).toEqual([8, 7])
    expect(listener.mock.calls.at(-1)[0].detail.count).toBe(2)

    fireEvent.click(screen.getByRole('button', { name: 'Toggle eight' }))
    expect(screen.getByRole('status').textContent).toBe('7')
    expect(JSON.parse(window.localStorage.getItem(KEY))).toEqual([7])
    expect(listener.mock.calls.at(-1)[0].detail.count).toBe(1)
    window.removeEventListener('storefront:favorites-updated', listener)
  })

  it('keeps in-memory state if local storage writes fail', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    render(<FavoritesProvider><FavoritesProbe /></FavoritesProvider>)

    fireEvent.click(screen.getByRole('button', { name: 'Toggle seven' }))
    expect(screen.getByText('7').textContent).toBe('7')
    setItem.mockRestore()
  })

  it('requires the provider', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<FavoritesProbe />)).toThrow('useFavorites must be used within FavoritesProvider')
    errorSpy.mockRestore()
  })
})
