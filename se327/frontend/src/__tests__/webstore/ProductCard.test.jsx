import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ProductCard from '../../pages/webstore/partials/ProductCard.jsx'
import { FavoritesProvider } from '../../pages/webstore/partials/FavoritesContext.jsx'

function renderCard(product) {
  return render(<MemoryRouter><FavoritesProvider><ProductCard product={product} /></FavoritesProvider></MemoryRouter>)
}

describe('ProductCard', () => {
  afterEach(() => cleanup())

  it('shows the product image, details, sale price, discount and known colour swatches', () => {
    renderCard({
      productId: 62, name: 'Accessory Edit', image: '/accessory.jpg', price: 960,
      originalPrice: 1110, discount: { type: 'percentage', value: 14 },
      color: ['Black', 'White'], category: 'Accessories', inStock: true,
    })

    expect(screen.getByRole('link').getAttribute('href')).toBe('/products/62')
    expect(screen.getByRole('img', { name: 'Accessory Edit' }).getAttribute('src')).toBe('/accessory.jpg')
    expect(screen.getByText('Accessories')).toBeTruthy()
    expect(screen.getByText('-14%')).toBeTruthy()
    expect(screen.getByText('1110 USD').className).toContain('line-through')
    expect(screen.getByText('960 USD')).toBeTruthy()
    expect(screen.getByTitle('Black').style.backgroundColor).toBe('rgb(34, 34, 34)')
    expect(screen.getByTitle('White').style.backgroundColor).toBe('rgb(255, 255, 255)')
    expect(screen.getByTitle('White').style.border).toBe('1px solid rgb(221, 221, 221)')
  })

  it('shows out of stock status in preference to a discount badge', () => {
    renderCard({ productId: 1, name: 'Sold out', image: '/sold.jpg', price: 12, discount: 5, inStock: false })

    expect(screen.getByText('Out of Stock')).toBeTruthy()
    expect(screen.queryByText('-5%')).toBeNull()
    expect(screen.queryByText('undefined USD')).toBeNull()
  })

  it('supports category objects, color aliases and products without a sale', () => {
    renderCard({
      productId: 2, name: 'Daily shirt', image: '/shirt.jpg', price: 25,
      colors: ['Grey', 'Unknown'], category: { name: 'Tops' }, inStock: true,
    })

    expect(screen.getByText('Tops')).toBeTruthy()
    expect(screen.getByTitle('Grey').style.backgroundColor).toBe('rgb(136, 136, 136)')
    expect(screen.getByTitle('Unknown').style.backgroundColor).toBe('rgb(204, 204, 204)')
    expect(screen.queryByText(/%/)).toBeNull()
    expect(screen.queryByText(/undefined USD/)).toBeNull()
  })

  it('renders distinct swatches for catalogue colors including lilac and mocha', () => {
    renderCard({
      productId: 12, name: 'Colour edit', image: '/colour.jpg', price: 40,
      colors: ['Lilac', 'Mocha', 'Dusty Rose', 'Powder Blue'], category: 'Accessories', inStock: true,
    })

    expect(screen.getByTitle('Lilac').style.backgroundColor).toBe('rgb(200, 162, 200)')
    expect(screen.getByTitle('Mocha').style.backgroundColor).toBe('rgb(139, 111, 92)')
    expect(screen.getByTitle('Dusty Rose').style.backgroundColor).toBe('rgb(192, 128, 129)')
    expect(screen.getByTitle('Powder Blue').style.backgroundColor).toBe('rgb(176, 213, 232)')
  })

  it('supports alternate color field, numeric discounts and favorite toggling', () => {
    const onFavoriteUpdate = vi.fn()
    window.addEventListener('storefront:favorites-updated', onFavoriteUpdate)
    renderCard({
      productId: 9, name: 'New bottoms', image: '/bottoms.jpg', price: 30,
      originalPrice: 40, discount: 25, colors: ['Navy'], inStock: true,
    })

    const heart = screen.getByRole('button', { name: 'Add to favorites' })
    expect(screen.getByText('-25%')).toBeTruthy()
    expect(screen.getByTitle('Navy').style.backgroundColor).toBe('rgb(27, 42, 74)')
    fireEvent.click(heart)

    expect(screen.getByRole('button', { name: 'Remove from favorites' }).getAttribute('aria-pressed')).toBe('true')
    expect(JSON.parse(window.localStorage.getItem('core-co-mock-favorites'))).toEqual([9])
    expect(onFavoriteUpdate).toHaveBeenCalledOnce()
    expect(onFavoriteUpdate.mock.calls[0][0].detail.count).toBe(1)
    window.removeEventListener('storefront:favorites-updated', onFavoriteUpdate)
  })

  it('does not render sale markup when a discount lacks an original price', () => {
    renderCard({ productId: 4, name: 'Regular', image: '/regular.jpg', price: 15, discount: 0, inStock: true })

    expect(screen.queryByText(/%/)).toBeNull()
    expect(screen.getByText('15 USD')).toBeTruthy()
  })
})
