import React from 'react'
import {describe, it, expect} from 'vitest'
import {fireEvent, render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Dropdown from '@/components/Dropdown'

function setup() {
  render(
    <div>
      <p>Elsewhere</p>
      <Dropdown trigger="•••" label="More">
        <button type="button">Edit</button>
        <p>Just text</p>
      </Dropdown>
    </div>,
  )
  return screen.getByRole('button', {name: 'More'})
}

describe('Dropdown', () => {
  it('opens on tap and closes on a tap anywhere outside it', async () => {
    const trigger = setup()
    await userEvent.click(trigger)
    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    fireEvent.pointerDown(screen.getByText('Elsewhere'))
    expect(screen.queryByText('Edit')).not.toBeInTheDocument()
  })

  it('stays open for taps inside the menu that are not choices', async () => {
    await userEvent.click(setup())
    fireEvent.pointerDown(screen.getByText('Just text'))
    fireEvent.click(screen.getByText('Just text'))
    expect(screen.getByText('Edit')).toBeInTheDocument()
  })

  it('closes after choosing an item, and on Escape', async () => {
    const trigger = setup()
    await userEvent.click(trigger)
    await userEvent.click(screen.getByText('Edit'))
    expect(screen.queryByText('Edit')).not.toBeInTheDocument()
    await userEvent.click(trigger)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByText('Edit')).not.toBeInTheDocument()
  })

  it('toggles closed from its own button', async () => {
    const trigger = setup()
    await userEvent.click(trigger)
    await userEvent.click(trigger)
    expect(screen.queryByText('Edit')).not.toBeInTheDocument()
  })
})
