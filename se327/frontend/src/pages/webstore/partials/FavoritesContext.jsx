import { createContext, useContext, useMemo, useState } from 'react'

const FavoritesContext = createContext(null)
const MOCK_FAVORITES_KEY = 'core-co-mock-favorites'

export function readMockFavorites() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(MOCK_FAVORITES_KEY) || '[]')
    return new Set(Array.isArray(saved) ? saved.map(Number).filter(Number.isFinite) : [])
  } catch {
    return new Set()
  }
}

export function getMockFavoriteCount() {
  return readMockFavorites().size
}

export function FavoritesProvider({ children }) {
  const [favoriteIds, setFavoriteIds] = useState(readMockFavorites)

  const value = useMemo(() => ({
    favoriteIds,
    loaded: true,
    toggleFavorite(productId) {
      setFavoriteIds((current) => {
        const next = new Set(current)
        const id = Number(productId)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        try { window.localStorage.setItem(MOCK_FAVORITES_KEY, JSON.stringify([...next])) } catch { /* mock state remains available in memory */ }
        window.dispatchEvent(new CustomEvent('storefront:favorites-updated', { detail: { count: next.size } }))
        return next
      })
    },
  }), [favoriteIds])

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

export function useFavorites() {
  const context = useContext(FavoritesContext)
  if (!context) throw new Error('useFavorites must be used within FavoritesProvider')
  return context
}
