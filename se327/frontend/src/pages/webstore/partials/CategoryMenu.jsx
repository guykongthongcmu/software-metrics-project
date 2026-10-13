import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink } from 'react-router-dom'
import { megaMenuData } from '../megaMenuData.js'

export default function CategoryMenu({ slug, title, open, onOpen, onClose, mobile = false }) {
  const items = megaMenuData[slug] || []
  const closeTimer = useRef(null)
  const cancelClose = () => {
    window.clearTimeout(closeTimer.current)
    closeTimer.current = null
  }
  const scheduleClose = () => {
    cancelClose()
    closeTimer.current = window.setTimeout(onClose, 240)
  }

  useEffect(() => () => window.clearTimeout(closeTimer.current), [])

  const panel = open && (
    <div className={`storefront-mega-panel ${mobile ? 'relative mt-1 max-h-[65vh] overflow-y-auto border-y border-stone-200 bg-white px-3 pb-4 pt-5' : 'fixed inset-x-0 top-24 z-60 max-h-[calc(100dvh-6rem)] overflow-y-auto border-y border-stone-200 bg-white px-5 pb-10 pt-8 shadow-[0_12px_40px_rgba(0,0,0,0.1)] sm:px-8 lg:px-12'}`} onMouseEnter={mobile ? undefined : cancelClose} onMouseLeave={mobile ? undefined : scheduleClose}>
      <button aria-label="Close category menu" className="absolute right-4 top-3 grid h-8 w-8 place-items-center text-xl leading-none text-stone-500 hover:bg-stone-100 hover:text-stone-900" onClick={onClose} type="button">×</button>
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 pt-2 sm:grid-cols-2 sm:gap-x-6 lg:grid-cols-4 lg:gap-x-8 lg:gap-y-5">
        {items.map((item) => (
          <Link className="group flex min-w-0 items-center gap-3 rounded-md px-2 py-1.5 text-[0.88rem] font-normal text-stone-800 transition-colors hover:bg-stone-100" key={`${slug}-${item.query}`} onClick={onClose} to={item.href}>
            <div className="h-13 w-13 shrink-0 overflow-hidden rounded bg-stone-100">
              <img alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" loading="lazy" onError={(event) => { event.currentTarget.style.visibility = 'hidden' }} src={item.image} />
            </div>
            <span className="leading-snug group-hover:text-stone-950">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
  let renderedPanel = null
  if (mobile) renderedPanel = panel
  else if (panel) renderedPanel = createPortal(panel, document.body)

  return (
    <>
      <div className="static lg:relative" onMouseEnter={mobile ? undefined : () => { cancelClose(); onOpen() }} onMouseLeave={mobile ? undefined : scheduleClose}>
        <div className="flex items-center gap-1">
          <NavLink className={({ isActive }) => `flex h-8 items-center rounded-full border text-[0.9rem] transition-colors hover:text-stone-500 ${isActive ? 'border-[#333] px-6' : 'border-transparent'}`} onClick={onClose} to={`/${slug}`}>{title}</NavLink>
          <button aria-expanded={open} aria-label={`Show ${title} categories`} className="storefront-category-toggle grid h-8 w-7 place-items-center text-stone-500 lg:hidden" onClick={onOpen} type="button">
            <svg aria-hidden="true" className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" /></svg>
          </button>
        </div>
      </div>
      {renderedPanel}
    </>
  )
}