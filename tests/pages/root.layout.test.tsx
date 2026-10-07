import React from 'react'
import {describe, it, expect, vi} from 'vitest'
import {render, screen} from '@testing-library/react'

vi.mock('next-auth', () => ({
  getServerSession: async () => ({user: {email: 'u@x'}}),
}))
vi.mock('next/font/google', () => ({
  Archivo: () => ({variable: 'font-archivo'}),
  JetBrains_Mono: () => ({variable: 'font-jetbrains'}),
}))
vi.mock('next/navigation', () => ({usePathname: () => '/songs'}))

describe('Root layout', () => {
  it('renders children inside the app shell with the band nav', async () => {
    const Layout = (await import('@/app/layout')).default
    const ui = await Layout({children: <div>hello-layout</div>})
    render(ui)
    expect(screen.getByText('hello-layout')).toBeInTheDocument()
    expect(screen.getAllByRole('link', {name: 'Songs'}).length).toBeGreaterThan(
      0,
    )
  })
})
