const colorSwatches = {
  white: '#FFFFFF', offwhite: '#F8F7F2', black: '#222222', grey: '#888888', gray: '#888888',
  navy: '#1B2A4A', blue: '#4A6FA5', red: '#C0392B', green: '#2E7D32', beige: '#E8DCC8',
  khaki: '#C3B091', brown: '#795548', pink: '#F06292', purple: '#7B1FA2', yellow: '#F9A825',
  orange: '#E65100', cream: '#FFFDD0', ivory: '#FFFFF0', natural: '#E8DCC8', camel: '#C19A6B',
  oat: '#D8C6A5', charcoal: '#36454F', stone: '#AAA397', olive: '#708238', slate: '#708090',
  taupe: '#8B7D6B', graphite: '#41424C', steel: '#71797E', sand: '#C2B280', mist: '#DCE1E5',
  rose: '#D98C9A', blush: '#DE9AA5', lilac: '#C8A2C8', coral: '#FF7F70', 'dusty rose': '#C08081',
  cloud: '#E6E6E6', mint: '#98DCC2', 'powder blue': '#B0D5E8', peach: '#F4B183', sky: '#87CEEB',
  lavender: '#B497D6', forest: '#355E3B', tortoise: '#704214', mocha: '#8B6F5C', tan: '#D2B48C',
  sage: '#9CAF88', teal: '#008080', burgundy: '#800020', maroon: '#800000', mustard: '#D4A017',
  rust: '#B7410E', silver: '#C0C0C0', denim: '#3F5F8A', wine: '#722F37', 'dark grey': '#555555',
  'dark gray': '#555555', 'light grey': '#D3D3D3', 'light gray': '#D3D3D3', 'mid grey': '#9B9B9B',
  'mid gray': '#9B9B9B', 'dark brown': '#4B3621', 'light brown': '#B08968', 'rose gold': '#B76E79',
  'soft pink': '#F4C2C2', 'ice blue': '#B7DDE5', 'sky blue': '#87CEEB', 'olive green': '#6B7132',
  'sage green': '#9CAF88', 'forest green': '#355E3B', 'chocolate brown': '#5C3317',
}

const lightColors = new Set(['white', 'offwhite', 'ivory', 'cream', 'cloud', 'mist', 'oat', 'sand'])

export function normalizeColorName(value) {
  return String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
}

export function getColorSwatch(value) {
  const name = normalizeColorName(value)
  if (colorSwatches[name]) return colorSwatches[name]
  const matchingName = Object.keys(colorSwatches)
    .sort((left, right) => right.length - left.length)
    .find((candidate) => name.includes(candidate))
  return matchingName ? colorSwatches[matchingName] : '#CCCCCC'
}

export function isLightColor(value) {
  return lightColors.has(normalizeColorName(value))
}
