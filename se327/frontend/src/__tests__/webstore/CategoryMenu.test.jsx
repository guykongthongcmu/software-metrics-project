import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CategoryMenu from '../../pages/webstore/partials/CategoryMenu.jsx'

afterEach(() => { cleanup(); vi.useRealTimers() })

function renderMenu(props = {}) {
  const onOpen = vi.fn()
  const onClose = vi.fn()
  const result = render(<MemoryRouter><CategoryMenu slug="men" title="Men" open={false} onOpen={onOpen} onClose={onClose} {...props} /></MemoryRouter>)
  return { ...result, onOpen, onClose }
}

describe('CategoryMenu', () => {
  it('opens and closes the desktop panel with its links', () => {
    const { onOpen, onClose, rerender } = renderMenu()
    const category = document.querySelector('a[href="/men"]')
    fireEvent.mouseEnter(category.parentElement.parentElement)
    expect(onOpen).toHaveBeenCalled()
    rerender(<MemoryRouter><CategoryMenu slug="men" title="Men" open onOpen={onOpen} onClose={onClose} /></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'T-Shirts & Sweatshirts' }).getAttribute('href'))
      .toBe('/search?q=t-shirt&cat=men&sort=relevance')
    fireEvent.click(screen.getByRole('button', { name: 'Close category menu' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('closes the desktop panel after a delayed pointer exit and cancels when re-entered', () => {
    vi.useFakeTimers()
    const { onClose, rerender } = renderMenu({ open: true })
    const panel = document.querySelector('.storefront-mega-panel')
    fireEvent.mouseLeave(panel)
    vi.advanceTimersByTime(239)
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.mouseEnter(panel)
    vi.advanceTimersByTime(1)
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.mouseLeave(panel)
    vi.advanceTimersByTime(240)
    expect(onClose).toHaveBeenCalledTimes(1)
    rerender(<MemoryRouter><CategoryMenu slug="men" title="Men" open onOpen={vi.fn()} onClose={onClose} /></MemoryRouter>)
    fireEvent.mouseLeave(document.querySelector('.storefront-mega-panel'))
    cleanup()
  })

  it('renders mobile inline content and tolerates an unknown category', () => {
    render(<MemoryRouter><CategoryMenu slug="unknown" title="Other" mobile open onOpen={vi.fn()} onClose={vi.fn()} /></MemoryRouter>)
    expect(document.querySelector('.storefront-mega-panel').parentElement).not.toBe(document.body)
    expect(screen.getByRole('link', { name: 'Other' }).getAttribute('href')).toBe('/unknown')
    expect(screen.queryByRole('link', { name: 'T-Shirts & Sweatshirts' })).toBeNull()
  })

  it('hides a failed menu image and closes after following an item', () => {
    const onClose = vi.fn()
    render(<MemoryRouter><CategoryMenu slug="men" title="Men" open mobile onOpen={vi.fn()} onClose={onClose} /></MemoryRouter>)
    const image = document.querySelector('img')
    fireEvent.error(image)
    expect(image.style.visibility).toBe('hidden')
    fireEvent.click(screen.getByRole('link', { name: 'T-Shirts & Sweatshirts' }))
    expect(onClose).toHaveBeenCalled()
  })
})
