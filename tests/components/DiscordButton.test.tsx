import React from 'react'
import {describe, it, expect} from 'vitest'
import {screen} from '@testing-library/react'
import {renderWithProviders} from '../utils'
import DiscordButton from '@/components/DiscordButton'

describe('DiscordButton', () => {
  it('renders a link to the Discord channel', () => {
    renderWithProviders(
      <DiscordButton channelId="1347070995122622545" label="Discord" />,
    )

    const link = screen.getByRole('link', {name: /discord/i})
    expect(link).toBeInTheDocument()
    const href = (link as HTMLAnchorElement).getAttribute('href') || ''
    expect(href).toMatch(
      /^https:\/\/discord\.com\/channels\/1347070995122622545$/,
    )
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel')
  })
})
