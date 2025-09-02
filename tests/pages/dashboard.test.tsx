import React from 'react'
import {describe, it, expect, vi, beforeEach} from 'vitest'
import {render, screen} from '@testing-library/react'

let prisma: any
let sessionVal: any = null

vi.mock('@/lib/db', () => ({
  get prisma() {
    return prisma
  },
}))
vi.mock('next-auth', () => ({
  getServerSession: () => Promise.resolve(sessionVal),
}))
vi.mock('next/link', () => ({
  default: ({href, children}: any) => <a href={href}>{children}</a>,
}))

// By default, calling redirect should throw to short-circuit execution in tests
const redirect = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`)
})
vi.mock('next/navigation', () => ({
  redirect,
}))

describe('Dashboard page (src/app/page.tsx)', () => {
  beforeEach(() => {
    prisma = {
      settings: {findUnique: vi.fn().mockResolvedValue({voteThreshold: 3})},
      proposal: {
        findMany: vi.fn().mockResolvedValue(
          Array.from({length: 13}).map((_, i) => ({
            id: `p${i}`,
            title: `Song ${i}`,
            artist: 'The Monkees',
            votes: Array.from({length: i % 4}),
            updatedAt: new Date().toISOString(),
          })),
        ),
        count: vi.fn().mockResolvedValue(42),
      },
    }
    redirect.mockClear()
    sessionVal = null
  })

  it('renders for guests without redirect', async () => {
    const Page = (await import('@/app/page')).default
    const ui = await Page()
    render(ui)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(redirect).not.toHaveBeenCalled()
  })

  it('renders summary cards when authenticated', async () => {
    sessionVal = {user: {email: 'user@example.com'}}
    const Page = (await import('@/app/page')).default
    const ui = await Page()
    render(ui)

    // Headings and labels
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Pending Proposals')).toBeInTheDocument()
    expect(screen.getByText('Near Threshold')).toBeInTheDocument()
    expect(screen.getByText('Approved')).toBeInTheDocument()

    // Quick sanity: links rendered
    expect(screen.getByRole('link', {name: /Vote/i})).toHaveAttribute(
      'href',
      '/vote',
    )
    expect(screen.getByRole('link', {name: /Setlist/i})).toHaveAttribute(
      'href',
      '/setlist',
    )
  })
})
