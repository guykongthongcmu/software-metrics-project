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

export function setLanguage(language) {
  if (!languages.includes(language) || language === getLanguage()) return
  current = language
  try {
    window.localStorage?.setItem(STORAGE_KEY, language)
  } catch {
    // The choice still applies for this visit if storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent('storefront:language-changed', { detail: { language } }))
}

// Storefront pages ask for lang=EN by default, swap in the selected language here.
export function withSelectedLanguage(path) {
  if (!path.startsWith('/client/')) return path
  return path.replace(/([?&]lang=)[^&#]*/, `$1${getLanguage()}`)
}
