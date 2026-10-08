import React from 'react'
import {describe, it, expect} from 'vitest'
import {render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ThemePicker from '@/components/ThemePicker'

describe('ThemePicker', () => {
  it('switches the theme now and remembers it on this device', async () => {
    render(<ThemePicker />)
    expect(screen.getByRole('button', {name: 'Match device'})).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await userEvent.click(screen.getByRole('button', {name: 'Light'}))
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('mw:theme')).toBe('"light"')
    await userEvent.click(screen.getByRole('button', {name: 'Dark'}))
    expect(document.documentElement.dataset.theme).toBe('dark')
    localStorage.clear()
  })
})
