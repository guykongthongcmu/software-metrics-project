import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient, isUnauthorizedError } from '../../../lib/apiClient.js'
import { loginPath } from '../../../lib/loginRedirect.js'

const FavoritesContext = createContext(null)

function dispatchFavoriteUpdate(count, productId, isFavorite) {
  window.dispatchEvent(new CustomEvent('storefront:favorites-updated', {
    detail: { count, productId, isFavorite },
  }))
}

export function FavoritesProvider({ children }) {
  const navigate = useNavigate()
  const [favoriteIds, setFavoriteIds] = useState(new Set())
  const [busyIds, setBusyIds] = useState(new Set())
  const [loaded, setLoaded] = useState(false)

  const loadFavorites = useCallback(async () => {
    try {
      const response = await apiClient.get('/client/favorites?lang=EN', { redirectOn401: false })
      const products = Array.isArray(response?.data?.products) ? response.data.products : []
      setFavoriteIds(new Set(products.map((product) => Number(product.productId)).filter(Number.isFinite)))
    } catch {
      setFavoriteIds(new Set())
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    let active = true
    apiClient.get('/client/favorites?lang=EN', { redirectOn401: false })
      .then((response) => {
        if (!active) return
        const products = Array.isArray(response?.data?.products) ? response.data.products : []
        setFavoriteIds(new Set(products.map((product) => Number(product.productId)).filter(Number.isFinite)))
      })
      .catch(() => { if (active) setFavoriteIds(new Set()) })
      .finally(() => { if (active) setLoaded(true) })
    const refreshFromApi = () => { void loadFavorites() }
    const applyFavoriteChange = (event) => {
      const { productId, isFavorite } = event.detail || {}
      if (productId == null || typeof isFavorite !== 'boolean') {
        refreshFromApi()
        return
      }
      const id = Number(productId)
      if (!Number.isFinite(id)) return
      setFavoriteIds((current) => {
        const next = new Set(current)
        if (isFavorite) next.add(id)
        else next.delete(id)
        return next
      })
    }
    window.addEventListener('storefront:refresh-header', refreshFromApi)
    window.addEventListener('storefront:favorites-updated', applyFavoriteChange)
    return () => {
      active = false
      window.removeEventListener('storefront:refresh-header', refreshFromApi)
      window.removeEventListener('storefront:favorites-updated', applyFavoriteChange)
    }
  }, [loadFavorites])

  const toggleFavorite = useCallback(async (productId) => {
    const id = Number(productId)
    if (!Number.isFinite(id) || busyIds.has(id)) return
    const currentlyFavorite = favoriteIds.has(id)
    setBusyIds((current) => new Set(current).add(id))
    try {
      const response = currentlyFavorite
        ? await apiClient.delete(`/client/favorites/${id}?lang=EN`, { redirectOn401: false })
        : await apiClient.post(`/client/favorites/${id}?lang=EN`, {}, { redirectOn401: false })
      const isFavorite = Boolean(response?.data?.isFavorite)
      const count = Number(response?.data?.favoritesCount) || 0
      setFavoriteIds((current) => {
        const next = new Set(current)
        if (isFavorite) next.add(id)
        else next.delete(id)
        return next
      })
      dispatchFavoriteUpdate(count, id, isFavorite)
    } catch (requestError) {
      if (isUnauthorizedError(requestError)) void navigate(loginPath())
    } finally {
      setBusyIds((current) => {
        const next = new Set(current)
        next.delete(id)
        return next
      })
    }
  }, [busyIds, favoriteIds, navigate])

  const value = useMemo(() => ({ favoriteIds, busyIds, loaded, toggleFavorite }), [favoriteIds, busyIds, loaded, toggleFavorite])
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

export function useFavorites() {
  const context = useContext(FavoritesContext)
  if (!context) throw new Error('useFavorites must be used within FavoritesProvider')
  return context
}
