import React from 'react'
import {describe, it, expect} from 'vitest'
import {screen} from '@testing-library/react'
import {renderWithProviders} from '../utils'

describe('Providers', () => {
  it('renders children', () => {
    renderWithProviders(<div>hello</div>)
    expect(screen.getByText('hello')).toBeInTheDocument()
  })
})
