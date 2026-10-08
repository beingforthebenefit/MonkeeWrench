export type ThemePref = 'system' | 'light' | 'dark'

export const THEME_KEY = 'mw:theme'
export const THEME_PREFS: ThemePref[] = ['system', 'light', 'dark']

/** Stored values are JSON (as written by useStoredState); anything else is "system". */
export function parseThemePref(raw: string | null): ThemePref {
  try {
    const v = raw == null ? null : JSON.parse(raw)
    return THEME_PREFS.includes(v) ? v : 'system'
  } catch {
    return 'system'
  }
}

export function resolveTheme(
  pref: ThemePref,
  systemDark: boolean,
): 'light' | 'dark' {
  return pref === 'system' ? (systemDark ? 'dark' : 'light') : pref
}

/** Sets html[data-theme] and the browser bar colour to match. */
export function applyTheme(pref: ThemePref) {
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const theme = resolveTheme(pref, dark)
  document.documentElement.dataset.theme = theme
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLORS[theme])
}

export const THEME_COLORS = {dark: '#111315', light: '#f7f5f0'} as const

/**
 * Runs in <head> before the first paint so a light-mode member never sees a
 * dark flash. Kept self-contained: it cannot import anything.
 */
export const themeScript = `(function(){try{var p=JSON.parse(localStorage.getItem(${JSON.stringify(THEME_KEY)})||'"system"')}catch(e){p='system'}if(p!=='light'&&p!=='dark')p=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=p})()`
