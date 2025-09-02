import React from 'react'
import {describe, it, expect, vi} from 'vitest'
import {render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GoogleSignInButton from '@/components/GoogleSignInButton'

// Rely on global mock from tests/setup.ts

describe('GoogleSignInButton', () => {
  it('calls signIn with google provider', async () => {
    const user = userEvent.setup()
    render(<GoogleSignInButton />)
    await user.click(screen.getByRole('button', {name: /sign in with google/i}))
    const mod = await import('next-auth/react')
    expect(mod.signIn).toHaveBeenCalledWith('google', {callbackUrl: '/setlist'})
  })
})
// Local mock for this test; component only uses signIn
vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
}))
