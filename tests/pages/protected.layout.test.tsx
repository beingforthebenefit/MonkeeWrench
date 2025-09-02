import React from 'react'
import {describe, it, expect, vi, beforeEach} from 'vitest'
import {render, screen} from '@testing-library/react'

let sessionVal: any = null

vi.mock('next-auth', () => ({
  getServerSession: () => Promise.resolve(sessionVal),
}))

const redirect = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`)
})
vi.mock('next/navigation', () => ({
  redirect,
}))

describe('(protected)/layout', () => {
  beforeEach(() => {
    sessionVal = null
    redirect.mockClear()
  })

  it('redirects unauthenticated to /login with callback', async () => {
    const Layout = (await import('@/app/(protected)/layout')).default
    await expect(Layout({children: <div>child</div>})).rejects.toThrow(
      'REDIRECT:/login?callbackUrl=%2Fsetlist',
    )
  })

  it('renders children when authenticated', async () => {
    sessionVal = {user: {email: 'u@x'}}
    const Layout = (await import('@/app/(protected)/layout')).default
    const ui = await Layout({children: <div>child</div>})
    render(ui)
    expect(screen.getByText('child')).toBeInTheDocument()
  })
})
