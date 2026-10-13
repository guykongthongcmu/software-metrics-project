import { cleanup, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { FavoritesProvider } from '../../pages/webstore/partials/FavoritesContext.jsx'
import SearchLocationProbe from './SearchLocationProbe.jsx'

export function makeProduct(productId, extra = {}) {
  return {
    productId,
    name: `Product ${productId}`,
    image: `/product-${productId}.jpg`,
    price: 25,
    originalPrice: null,
    color: ['Lilac', 'Mocha'],
    category: { slug: 'men', name: 'Men' },
    inStock: true,
    ...extra,
  }
}

export function success(data) {
  return { data }
}

export function renderSearchPage(component, entry = '/search', options = {}) {
  if (options.scrollTo) vi.stubGlobal('scrollTo', options.scrollTo)
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <FavoritesProvider>
        {component}
        <SearchLocationProbe />
      </FavoritesProvider>
    </MemoryRouter>,
  )
}

export function cleanSearchTest() {
  cleanup()
  vi.unstubAllGlobals()
  window.localStorage.clear()
}
