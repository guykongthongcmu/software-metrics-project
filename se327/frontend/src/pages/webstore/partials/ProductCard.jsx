import { Link } from 'react-router-dom'
import { useFavorites } from './FavoritesContext.jsx'

const colorSwatches = {
  white: '#FFFFFF', black: '#222222', grey: '#888888', gray: '#888888', navy: '#1B2A4A',
  blue: '#4A6FA5', red: '#C0392B', green: '#2E7D32', beige: '#E8DCC8', khaki: '#C3B091',
  brown: '#795548', pink: '#F06292', purple: '#7B1FA2', yellow: '#F9A825', orange: '#E65100',
  cream: '#FFFDD0', ivory: '#FFFFF0', natural: '#E8DCC8',
}
const lightColors = new Set(['white', 'ivory', 'cream'])

/** @param {{product: object}} props */
export default function ProductCard({ product }) {
  const { favoriteIds, toggleFavorite } = useFavorites()
  const currentFavorite = favoriteIds.has(Number(product.productId))
  const discount = product.discount?.value ?? product.discount
  const colors = product.color || product.colors || []

  function onToggleFavorite(event) {
    event.preventDefault()
    event.stopPropagation()
    toggleFavorite(product.productId)
  }

  return (
    <Link to={`/products/${product.productId}`} className="group block text-inherit">
      <div className="relative mb-6 aspect-[4/5] overflow-hidden bg-white">
        <img className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" src={product.image} alt={product.name} />
        <button type="button" aria-label={currentFavorite ? 'Remove from favorites' : 'Add to favorites'} aria-pressed={currentFavorite} onClick={onToggleFavorite} className="absolute right-[15px] top-[15px] z-10 grid h-6 w-6 place-items-center text-[#666]">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="1.5" fill={currentFavorite ? 'currentColor' : 'none'} aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
        </button>
        {!product.inStock ? <span className="absolute left-[15px] top-[15px] z-10 bg-[#555] px-2 py-1 text-xs font-semibold text-white">Out of Stock</span> : discount ? <span className="absolute left-[15px] top-[15px] z-10 rounded bg-white px-2 py-1 text-xs font-semibold text-black">-{discount}%</span> : null}
        <div className="absolute inset-x-0 bottom-0 translate-y-full bg-black/60 px-2.5 py-2.5 text-center text-xs tracking-[2px] text-white transition-transform duration-300 group-hover:translate-y-0">QUICK VIEW</div>
      </div>
      <div>
        {product.category && <span className="text-xs text-muted">{typeof product.category === 'string' ? product.category : product.category.name}</span>}
        <h3 className="text-sm font-normal text-[#333]">{product.name}</h3>
        <div className="mt-2 flex min-h-3 gap-1.5" aria-label={colors.length ? `Available colours: ${colors.join(', ')}` : undefined}>
          {colors.map((color, index) => {
            const name = String(color).trim()
            const key = name.toLowerCase()
            return <span key={`${key}-${index}`} title={name} className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: colorSwatches[key] || '#ccc', border: lightColors.has(key) ? '1px solid #ddd' : undefined }} />
          })}
        </div>
        <p className="mt-2 text-sm text-[#333]">
          {product.originalPrice != null && discount ? <span className="mr-2 text-[#999] line-through">{product.originalPrice} USD</span> : null}
          {product.price} USD
        </p>
      </div>
    </Link>
  )
}
