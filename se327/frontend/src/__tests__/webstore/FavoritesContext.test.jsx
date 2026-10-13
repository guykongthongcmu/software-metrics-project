import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ApiError, apiClient } from '../../lib/apiClient.js'
import { FavoritesProvider, useFavorites } from '../../pages/webstore/partials/FavoritesContext.jsx'

vi.mock('../../lib/apiClient.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }
})

function FavoritesProbe() {
  const { favoriteIds, loaded, toggleFavorite } = useFavorites()
  return (
    <div>
      <output aria-label="Favorite ids">{[...favoriteIds].join(',')}</output>
      <output aria-label="Favorites loaded">{String(loaded)}</output>
      <button onClick={() => { void toggleFavorite(7) }} type="button">Toggle seven</button>
      <button onClick={() => { void toggleFavorite('8') }} type="button">Toggle eight</button>
    </div>
  )
}

function renderFavorites() {
  return render(<MemoryRouter><FavoritesProvider><FavoritesProbe /></FavoritesProvider></MemoryRouter>)
}

describe('FavoritesProvider', () => {
  beforeEach(() => {
    apiClient.get.mockReset()
    apiClient.post.mockReset()
    apiClient.delete.mockReset()
    apiClient.get.mockResolvedValue({ data: { products: [{ productId: 8 }, { productId: 'invalid' }] } })
    apiClient.post.mockResolvedValue({ data: { isFavorite: true, favoritesCount: 2 } })
    apiClient.delete.mockResolvedValue({ data: { isFavorite: false, favoritesCount: 0 } })
  })

  afterEach(() => cleanup())

  it('loads favorite ids from the favorites API', async () => {
    renderFavorites()

    expect((await screen.findByLabelText('Favorite ids')).textContent).toBe('8')
    expect(screen.getByLabelText('Favorites loaded').textContent).toBe('true')
    expect(apiClient.get).toHaveBeenCalledWith('/client/favorites?lang=EN', { redirectOn401: false })
  })

  it('adds and removes favorites through the API and broadcasts the count', async () => {
    const listener = vi.fn()
    window.addEventListener('storefront:favorites-updated', listener)
    renderFavorites()
    await screen.findByLabelText('Favorites loaded')

    fireEvent.click(screen.getByRole('button', { name: 'Toggle seven' }))
    await waitFor(() => expect(screen.getByLabelText('Favorite ids').textContent).toBe('8,7'))
    expect(apiClient.post).toHaveBeenCalledWith('/client/favorites/7?lang=EN', {}, { redirectOn401: false })
    expect(listener.mock.calls.at(-1)[0].detail).toMatchObject({ count: 2, productId: 7, isFavorite: true })

    fireEvent.click(screen.getByRole('button', { name: 'Toggle eight' }))
    await waitFor(() => expect(apiClient.delete).toHaveBeenCalledWith('/client/favorites/8?lang=EN', { redirectOn401: false }))
    expect(screen.getByLabelText('Favorite ids').textContent).toBe('7')
    expect(listener.mock.calls.at(-1)[0].detail).toMatchObject({ count: 0, productId: 8, isFavorite: false })
    window.removeEventListener('storefront:favorites-updated', listener)
  })

  it('uses an empty list when loading favorites fails', async () => {
    apiClient.get.mockRejectedValueOnce(new Error('offline'))
    renderFavorites()

    expect((await screen.findByLabelText('Favorites loaded')).textContent).toBe('true')
    expect(screen.getByLabelText('Favorite ids').textContent).toBe('')
  })

  it('navigates to login when changing favorites returns unauthorized', async () => {
    apiClient.post.mockRejectedValueOnce(new ApiError('Unauthorized', { status: 401 }))
    render(
      <MemoryRouter initialEntries={['/favorites']}>
        <FavoritesProvider><FavoritesProbe /></FavoritesProvider>
      </MemoryRouter>,
    )
    await screen.findByLabelText('Favorites loaded')
    fireEvent.click(screen.getByRole('button', { name: 'Toggle seven' }))

    await waitFor(() => expect(apiClient.post).toHaveBeenCalled())
  })

  it('requires the provider', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<MemoryRouter><FavoritesProbe /></MemoryRouter>)).toThrow('useFavorites must be used within FavoritesProvider')
    errorSpy.mockRestore()
  })
})
