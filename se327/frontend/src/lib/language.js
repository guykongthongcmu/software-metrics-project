const STORAGE_KEY = 'language'
const languages = ['EN', 'TH']
let current = null

function readStoredLanguage() {
  try {
    const stored = window.localStorage?.getItem(STORAGE_KEY)
    return languages.includes(stored) ? stored : 'EN'
  } catch {
    return 'EN'
  }
}

export function getLanguage() {
  if (!current) current = readStoredLanguage()
  return current
}

function applyLanguage(language) {
  current = language
  document.documentElement.lang = language.toLowerCase()
  window.dispatchEvent(new CustomEvent('storefront:language-changed', { detail: { language } }))
}

export function setLanguage(language) {
  if (!languages.includes(language) || language === getLanguage()) return
  try {
    window.localStorage?.setItem(STORAGE_KEY, language)
  } catch {
    // The choice still applies for this visit if storage is unavailable.
  }
  applyLanguage(language)
}

// Keep other open tabs in step with the language chosen in this one.
window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY || !languages.includes(event.newValue) || event.newValue === getLanguage()) return
  applyLanguage(event.newValue)
})

document.documentElement.lang = getLanguage().toLowerCase()

// Storefront pages ask for lang=EN by default, swap in the selected language here.
export function withSelectedLanguage(path) {
  if (!path.startsWith('/client/')) return path
  return path.replace(/([?&]lang=)[^&#]*/, `$1${getLanguage()}`)
}
