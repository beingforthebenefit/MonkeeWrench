import React from 'react'
import {describe, it, expect, vi} from 'vitest'
import {screen} from '@testing-library/react'
import {renderWithProviders} from '../utils'
import LoginPage from '@/app/login/page'

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (k: string) => (k === 'error' ? 'AccessDenied' : null),
  }),
}))

describe('LoginPage', () => {
  it('shows access denied error from query', () => {
    renderWithProviders(<LoginPage />)
    expect(screen.getByRole('alert')).toHaveTextContent('Access denied')
  })
})
