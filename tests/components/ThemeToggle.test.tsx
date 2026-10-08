import React from 'react'
import {describe, it, expect} from 'vitest'
import {render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ThemeToggle from '@/components/ThemeToggle'

describe('ThemeToggle', () => {
  it('cycles auto → light → dark → auto, applying and remembering each', async () => {
    localStorage.clear()
    render(<ThemeToggle />)
    const button = () => screen.getByRole('button', {name: /^Appearance/})
    expect(button()).toHaveAccessibleName(/Appearance: Auto/)

    await userEvent.click(button())
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('mw:theme')).toBe('"light"')
    expect(button()).toHaveAccessibleName(/Appearance: Light/)

    await userEvent.click(button())
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(button()).toHaveAccessibleName(/Appearance: Dark/)

    await userEvent.click(button())
    expect(localStorage.getItem('mw:theme')).toBe('"system"')
    // jsdom's matchMedia matches nothing, so "auto" resolves to light
    expect(document.documentElement.dataset.theme).toBe('light')
    localStorage.clear()
  })
})
