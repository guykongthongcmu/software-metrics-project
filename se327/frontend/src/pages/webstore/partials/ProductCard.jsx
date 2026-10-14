import { Link } from 'react-router-dom'
import { useFavorites } from './FavoritesContext.jsx'
import { getColorSwatch, isLightColor, normalizeColorName } from './colorSwatches.js'

/**
 * @typedef {object} ProductCardProduct
 * @property {number|string} productId
 * @property {string} name
 * @property {string} [image]
 * @property {number|string} [price]
 * @property {number|string|null} [originalPrice]
 * @property {number|{type?: string, value?: number|string}|null} [discount]
 * @property {string[]} [color]
 * @property {string[]} [colors]
 * @property {string|{name?: string}} [category]
 * @property {boolean} [inStock]
 */

/** @param {{product: ProductCardProduct, compact?: boolean, catalogStyle?: boolean, showColors?: boolean}} props */
export default function ProductCard({ product, compact = false, catalogStyle = false, showColors = false }) {
  const { favoriteIds, busyIds, loaded, toggleFavorite } = useFavorites()
  const currentFavorite = favoriteIds.has(Number(product.productId))
  const favoriteBusy = busyIds.has(Number(product.productId))
  const discount = typeof product.discount === 'object' ? product.discount?.value : product.discount
  const hasSale = catalogStyle ? product.originalPrice != null : Boolean(discount)
  const colors = product.color || product.colors || []
  const imageStyle = compact || catalogStyle ? 'mb-0 aspect-[3/4]' : 'mb-6 aspect-[4/5]'
  const productNameStyle = compact
    ? 'mb-0 text-[0.65rem] font-normal uppercase tracking-[0.07em] text-[#2a2520]'
    : catalogStyle
      ? 'mb-1 text-[0.95rem] font-medium leading-[1.4] text-[#333]'
      : 'text-sm font-normal text-[#333]'
  const priceStyle = compact
    ? 'mt-0 text-[0.72rem] text-[#b89b6e]'
    : catalogStyle
      ? 'mb-0 mt-0 text-[0.85rem] text-[#666]'
      : 'mt-2 text-sm text-[#333]'

  function formatCatalogPrice(value) {
    const amount = Number(value)
    return Number.isFinite(amount) ? `$${amount.toLocaleString('en-US')}` : value
  }

  function onToggleFavorite(event) {
    event.preventDefault()
    event.stopPropagation()
    void toggleFavorite(product.productId)
  }

  return (
    <Link to={`/products/${product.productId}`} className="group block text-inherit">
      <div className={`relative overflow-hidden bg-white ${imageStyle}`}>
        <img className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" src={product.image} alt={product.name} />
        <button type="button" aria-label={currentFavorite ? 'Remove from favorites' : 'Add to favorites'} aria-pressed={currentFavorite} disabled={!loaded || favoriteBusy} onClick={onToggleFavorite} className="absolute right-[15px] top-[15px] z-10 grid h-6 w-6 place-items-center text-[#666] disabled:cursor-wait disabled:opacity-60">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="1.5" fill={currentFavorite ? 'currentColor' : 'none'} aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
        </button>
        {!product.inStock ? <span className="absolute left-[15px] top-[15px] z-10 bg-[#555] px-2 py-1 text-xs font-semibold text-white">Out of Stock</span> : hasSale ? <span className={`absolute left-2 top-2 z-10 rounded-[0.375rem] px-[0.65em] py-[0.35em] text-[0.75em] font-bold leading-none ${catalogStyle ? 'bg-[#dc3545] text-white' : 'bg-white text-black'}`}>{catalogStyle ? 'SALE' : `-${discount}%`}</span> : null}
        {!compact && <div className="absolute inset-x-0 bottom-0 translate-y-full bg-black/60 px-2.5 py-2.5 text-center text-xs tracking-[2px] text-white transition-transform duration-300 group-hover:translate-y-0">QUICK VIEW</div>}
      </div>
      <div className={catalogStyle ? 'p-2' : ''}>
        {!compact && product.category && <span className="text-xs text-muted">{typeof product.category === 'string' ? product.category : product.category.name}</span>}
        <h3 className={productNameStyle}>{product.name}</h3>
        {(!compact || showColors) && <div className="mt-2 flex min-h-3 gap-1.5" aria-label={colors.length ? `Available colours: ${colors.join(', ')}` : undefined}>
          {colors.map((color, index) => {
            const name = String(color).trim()
            const key = normalizeColorName(name)
            return <span key={`${key}-${index}`} title={name} className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: getColorSwatch(name), border: isLightColor(name) ? '1px solid #ddd' : undefined }} />
          })}
        </div>}
        <p className={priceStyle}>
          {product.originalPrice != null && (catalogStyle ? hasSale : Boolean(discount)) ? <span className={`mr-2 text-[#999] line-through ${catalogStyle ? 'text-[0.85rem]' : ''}`}>{catalogStyle ? formatCatalogPrice(product.originalPrice) : `${product.originalPrice} USD`}</span> : null}
          {catalogStyle ? formatCatalogPrice(product.price) : `${product.price} USD`}
        </p>
      </div>
    </Link>
  )
}
