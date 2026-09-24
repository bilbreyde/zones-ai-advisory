// Theme selection — applies data-theme to <html> as soon as this module loads.
// Imported first in main.jsx so the saved theme is in place before React renders (no flash).
// Theme colors live in index.css (:root = default) and themes.css (per data-theme overrides).

const STORAGE_KEY = 'zones-theme'

export const THEMES = [
  { id: 'default',       label: 'Default (Dark Navy)' },
  { id: 'light',         label: 'Light' },
  { id: 'high-contrast', label: 'High Contrast' },
  { id: 'deuteranopia',  label: 'Deuteranopia' },
  { id: 'protanopia',    label: 'Protanopia' },
]

const THEME_IDS = THEMES.map(t => t.id)

function readSaved() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return THEME_IDS.includes(saved) ? saved : 'default'
  } catch {
    return 'default'   // storage blocked (private mode, disabled site data)
  }
}

function apply(name) {
  document.documentElement.setAttribute('data-theme', name)
}

let current = readSaved()
apply(current)

export function getTheme() {
  return current
}

export function setTheme(name) {
  if (!THEME_IDS.includes(name)) return
  current = name
  apply(name)
  try { localStorage.setItem(STORAGE_KEY, name) } catch { /* theme still applies for this session */ }
}
