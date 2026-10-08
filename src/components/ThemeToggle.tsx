'use client'

import {useStoredState} from '@/components/useStoredState'
import {THEME_KEY, applyTheme, type ThemePref} from '@/lib/theme'

const NEXT: Record<ThemePref, ThemePref> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
}
const NAME: Record<ThemePref, string> = {
  system: 'Auto (matches device)',
  light: 'Light',
  dark: 'Dark',
}

/**
 * One tap cycles Auto → Light → Dark. The icon shows the current choice.
 * Remembered on this device only.
 */
export default function ThemeToggle() {
  const [pref, setPref] = useStoredState<ThemePref>(THEME_KEY, 'system')
  return (
    <button
      type="button"
      onClick={() => {
        setPref(NEXT[pref])
        applyTheme(NEXT[pref])
      }}
      aria-label={`Appearance: ${NAME[pref]}. Switch to ${NAME[NEXT[pref]]}`}
      title={`Appearance: ${NAME[pref]}`}
      className="flex h-11 w-11 items-center justify-center rounded-full text-muted hover:text-text"
    >
      <ThemeIcon pref={pref} />
    </button>
  )
}

function ThemeIcon({pref}: {pref: ThemePref}) {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  if (pref === 'light')
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    )
  if (pref === 'dark')
    return (
      <svg {...common}>
        <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
      </svg>
    )
  // Auto: a circle half light, half dark
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" />
    </svg>
  )
}
