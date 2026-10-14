import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'
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
      <button onClick={() => { void toggleFavorite('invalid') }} type="button">Toggle invalid</button>
    </div>
  )
}

function CurrentPath() {
  return <output aria-label="Current path">{useLocation().pathname}</output>
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

  it('uses an empty list when the API response has no products array', async () => {
    apiClient.get.mockResolvedValueOnce({ data: { products: null } })
    renderFavorites()

    expect((await screen.findByLabelText('Favorites loaded')).textContent).toBe('true')
    expect(screen.getByLabelText('Favorite ids').textContent).toBe('')
  })

  it('refreshes from header events and applies valid favorite updates', async () => {
    renderFavorites()
    await screen.findByLabelText('Favorites loaded')

    window.dispatchEvent(new Event('storefront:refresh-header'))
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2))
    window.dispatchEvent(new CustomEvent('storefront:favorites-updated', { detail: { productId: 7, isFavorite: true } }))
    await waitFor(() => expect(screen.getByLabelText('Favorite ids').textContent).toBe('8,7'))
    window.dispatchEvent(new CustomEvent('storefront:favorites-updated', { detail: { productId: 7, isFavorite: false } }))
    await waitFor(() => expect(screen.getByLabelText('Favorite ids').textContent).toBe('8'))
    window.dispatchEvent(new CustomEvent('storefront:favorites-updated', { detail: { productId: 'invalid', isFavorite: true } }))
    expect(screen.getByLabelText('Favorite ids').textContent).toBe('8')
    window.dispatchEvent(new CustomEvent('storefront:favorites-updated', { detail: { productId: 7 } }))
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(3))
    window.dispatchEvent(new CustomEvent('storefront:favorites-updated', { detail: null }))
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(4))
    window.dispatchEvent(new CustomEvent('storefront:favorites-updated', { detail: {} }))
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(5))
  })

  it('ignores an initial favorites response that arrives after unmount', async () => {
    let resolveFavorites
    apiClient.get.mockReturnValueOnce(new Promise((resolve) => { resolveFavorites = resolve }))
    const view = renderFavorites()
    view.unmount()
    resolveFavorites({ data: { products: [{ productId: 7 }] } })
    await Promise.resolve()
    expect(apiClient.get).toHaveBeenCalledTimes(1)
  })

  it('ignores an initial favorites failure after unmount', async () => {
    let rejectFavorites
    apiClient.get.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectFavorites = reject }))
    const view = renderFavorites()
    view.unmount()
    rejectFavorites(new Error('late failure'))
    await Promise.resolve()
    expect(apiClient.get).toHaveBeenCalledTimes(1)
  })

  it('clears favorite ids when a header refresh fails', async () => {
    renderFavorites()
    await screen.findByLabelText('Favorites loaded')
    apiClient.get.mockRejectedValueOnce(new Error('offline'))
    window.dispatchEvent(new Event('storefront:refresh-header'))

    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByLabelText('Favorite ids').textContent).toBe(''))
  })

  it('clears favorite ids when a header refresh has no products array', async () => {
    renderFavorites()
    await screen.findByLabelText('Favorites loaded')
    apiClient.get.mockResolvedValueOnce({ data: { products: null } })
    window.dispatchEvent(new Event('storefront:refresh-header'))

    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByLabelText('Favorite ids').textContent).toBe(''))
  })

  it('ignores invalid ids and suppresses duplicate requests while a toggle is pending', async () => {
    let finishPost
    apiClient.post.mockReturnValue(new Promise((resolve) => { finishPost = resolve }))
    renderFavorites()
    await screen.findByLabelText('Favorites loaded')

    fireEvent.click(screen.getByRole('button', { name: 'Toggle invalid' }))
    expect(apiClient.post).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Toggle seven' }))
    fireEvent.click(screen.getByRole('button', { name: 'Toggle seven' }))
    expect(apiClient.post).toHaveBeenCalledTimes(1)
    finishPost({ data: { isFavorite: true, favoritesCount: 2 } })
    await waitFor(() => expect(screen.getByLabelText('Favorite ids').textContent).toBe('8,7'))
  })

  it('navigates to login when changing favorites returns unauthorized', async () => {
    apiClient.post.mockRejectedValueOnce(Object.assign(new Error('Unauthorized'), { status: 401 }))
    render(
      <MemoryRouter initialEntries={['/favorites']}>
        <CurrentPath />
        <Routes>
          <Route path="/favorites" element={<FavoritesProvider><FavoritesProbe /></FavoritesProvider>} />
          <Route path="/login" element={<p>Login page</p>} />
        </Routes>
      </MemoryRouter>,
    )
    await screen.findByLabelText('Favorites loaded')
    fireEvent.click(screen.getByRole('button', { name: 'Toggle seven' }))

    expect(await screen.findByText('Login page')).toBeTruthy()
  })

  it('does not redirect for favorite errors that are not unauthorized', async () => {
    apiClient.post.mockRejectedValueOnce(Object.assign(new Error('Unavailable'), { status: 503 }))
    render(
      <MemoryRouter initialEntries={['/favorites']}>
        <CurrentPath />
        <Routes>
          <Route path="/favorites" element={<FavoritesProvider><FavoritesProbe /></FavoritesProvider>} />
          <Route path="/login" element={<p>Login page</p>} />
        </Routes>
      </MemoryRouter>,
    )
    await screen.findByLabelText('Favorites loaded')
    fireEvent.click(screen.getByRole('button', { name: 'Toggle seven' }))

    await waitFor(() => expect(screen.getByLabelText('Current path').textContent).toBe('/favorites'))
    expect(screen.queryByText('Login page')).toBeNull()
    expect(screen.getByLabelText('Favorite ids').textContent).toBe('8')
  })

  it('requires the provider', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<MemoryRouter><FavoritesProbe /></MemoryRouter>)).toThrow('useFavorites must be used within FavoritesProvider')
    errorSpy.mockRestore()
  })
})
