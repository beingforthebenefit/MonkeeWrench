import React from 'react'
import {describe, it, expect} from 'vitest'
import userEvent from '@testing-library/user-event'
import {renderWithProviders} from '../utils'
import {screen} from '@testing-library/react'
import Propose from '@/app/(protected)/propose/page'

describe('Propose page', () => {
  it('validates URLs and shows helper text', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Propose />)

    const chartField = screen.getByLabelText('Chart URL')
    await user.type(chartField, 'example')
    // It should show a helper text indicating bad URL
    expect(
      screen.getByText(/must start with http\(s\):\/\//i),
    ).toBeInTheDocument()
  })
})
