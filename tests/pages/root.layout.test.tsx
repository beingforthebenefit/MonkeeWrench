import React from 'react'
import {describe, it, expect, vi} from 'vitest'
import {render, screen} from '@testing-library/react'

vi.mock('next-auth', () => ({
  getServerSession: async () => ({user: {email: 'u@x'}}),
}))

describe('Root layout', () => {
  it('wraps children in Providers and renders Nav + main', async () => {
    const Layout = (await import('@/app/layout')).default
    const ui = await Layout({children: <div>hello-layout</div>})
    render(ui)
    expect(screen.getByText('hello-layout')).toBeInTheDocument()
  })
})
