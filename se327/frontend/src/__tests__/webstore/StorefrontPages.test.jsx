import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AboutPage from '../../pages/webstore/AboutPage.jsx'
import ContactPage from '../../pages/webstore/ContactPage.jsx'
import StorefrontFooter from '../../pages/webstore/partials/StorefrontFooter.jsx'

function renderPage(Page) {
  return render(<MemoryRouter><Page /></MemoryRouter>)
}

describe('storefront information pages', () => {
  it('shows the brand story, values and collection link', () => {
    renderPage(AboutPage)

    expect(screen.getByRole('heading', { name: 'CORE & CO' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Our Story' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'The Philosophy' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Timeless Design' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Premium Craft' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Conscious Ethos' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'EXPLORE COLLECTION' }).getAttribute('href')).toBe('/products')
  })

  it('shows store contact methods and the Bangkok map', () => {
    renderPage(ContactPage)

    expect(screen.getByRole('heading', { name: 'Contact Us' })).toBeTruthy()
    expect(screen.getByText(/123 Fashion Ave/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'coreandco2026@gmail.com' }).getAttribute('href')).toBe('mailto:coreandco2026@gmail.com')
    expect(screen.getByRole('link', { name: 'Instagram: @coreandco_official' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Facebook: Core & Co' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Twitter: @coreandco_th' })).toBeTruthy()
    expect(screen.getByTitle('Map to Core & Co in Bangkok').getAttribute('loading')).toBe('lazy')
  })

  it('links to product, information and membership destinations from the footer', () => {
    renderPage(StorefrontFooter)

    for (const [label, href] of [['Men', '/men'], ['Women', '/women'], ['Kids', '/kids'], ['Baby', '/baby'], ['Unisex', '/unisex'], ['Home', '/'], ['About', '/about'], ['Contact Us', '/contact'], ['SIGN UP', '/auth/signup'], ['LOG IN', '/login']]) {
      expect(screen.getByRole('link', { name: label }).getAttribute('href')).toBe(href)
    }
    expect(screen.getByText('© 2026 Core & Co. All rights reserved.')).toBeTruthy()
  })
})
