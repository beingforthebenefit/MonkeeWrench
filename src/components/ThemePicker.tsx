'use client'

import {useStoredState} from '@/components/useStoredState'
import {THEME_KEY, applyTheme, type ThemePref} from '@/lib/theme'

const OPTIONS: {value: ThemePref; label: string}[] = [
  {value: 'system', label: 'Match device'},
  {value: 'light', label: 'Light'},
  {value: 'dark', label: 'Dark'},
]

/** Light, dark or follow the device. Remembered on this device only. */
export default function ThemePicker() {
  const [pref, setPref] = useStoredState<ThemePref>(THEME_KEY, 'system')
  return (
    <fieldset>
      <legend className="text-sm text-muted">Appearance</legend>
      <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl border border-line-2 p-1">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={pref === o.value}
            onClick={() => {
              setPref(o.value)
              applyTheme(o.value)
            }}
            className={`min-h-11 rounded-lg text-sm font-semibold ${pref === o.value ? 'bg-text text-ink' : 'text-muted'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
