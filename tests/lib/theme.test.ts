import {describe, it, expect} from 'vitest'
import {parseThemePref, resolveTheme, themeScript} from '@/lib/theme'

describe('theme', () => {
  it('reads stored choices and falls back to system', () => {
    expect(parseThemePref('"light"')).toBe('light')
    expect(parseThemePref('"dark"')).toBe('dark')
    expect(parseThemePref(null)).toBe('system')
    expect(parseThemePref('"purple"')).toBe('system')
    expect(parseThemePref('not json')).toBe('system')
  })

  it('follows the device only when set to system', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('pre-paint script applies the stored choice', () => {
    localStorage.setItem('mw:theme', '"light"')
    new Function(themeScript)()
    expect(document.documentElement.dataset.theme).toBe('light')
    localStorage.setItem('mw:theme', '"dark"')
    new Function(themeScript)()
    expect(document.documentElement.dataset.theme).toBe('dark')
    localStorage.clear()
  })
})
