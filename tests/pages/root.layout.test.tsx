import React from 'react'
import {describe, it, expect, vi, beforeEach} from 'vitest'
import {render, screen} from '@testing-library/react'

let bands: {id: string; name: string; isAdmin: boolean}[] = []

vi.mock('next-auth', () => ({
  getServerSession: async () => ({user: {email: 'u@x'}}),
}))
vi.mock('next/font/google', () => ({
  Archivo: () => ({variable: 'font-archivo'}),
  JetBrains_Mono: () => ({variable: 'font-jetbrains'}),
}))
vi.mock('next/navigation', () => ({
  usePathname: () => '/songs',
  useRouter: () => ({refresh: vi.fn(), push: vi.fn()}),
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {findUnique: async () => ({id: 'u1', isOwner: false})},
    activity: {findFirst: async () => ({id: 'a1'})},
  },
}))
vi.mock('@/lib/band', async (orig) => {
  const actual: any = await orig()
  const full = (b: {id: string; name: string; isAdmin: boolean}) => ({
    ...b,
    slug: b.id,
    appName: b.id === 'mb' ? 'Monkee Wrench' : 'Bandstand',
    timezone: 'America/Los_Angeles',
    chatUrl: b.id === 'mb' ? 'https://discord.com/channels/1' : null,
    tributeTo: null,
    voteThreshold: 2,
    scheduling: b.id !== 'h',
    iconAt: null,
  })
  return {
    ...actual,
    currentBand: async () => ({
      bands: bands.map(full),
      band: bands.length === 1 ? full(bands[0]) : null,
    }),
    brandForRequest: async () => ({
      band: null,
      appName: 'Bandstand',
      iconUrl: '/icons/default-512.png',
    }),
  }
})

describe('Root layout', () => {
  beforeEach(() => {
    ;(globalThis as any).__mockSession = {
      data: {user: {name: 'Gerald', email: 'u@x'}},
      status: 'authenticated',
    }
  })

  it("shows the band's own app name, tabs and chat link", async () => {
    bands = [{id: 'mb', name: 'Monkee Business', isAdmin: false}]
    const Layout = (await import('@/app/layout')).default
    render(await Layout({children: <div>hello-layout</div>}))
    expect(screen.getByText('hello-layout')).toBeInTheDocument()
    expect(screen.getByText('Monkee Wrench')).toBeInTheDocument()
    expect(screen.getAllByRole('link', {name: 'Songs'}).length).toBeGreaterThan(
      0,
    )
  })

  it('has no band tabs before a band is picked', async () => {
    bands = [
      {id: 'mb', name: 'Monkee Business', isAdmin: false},
      {id: 'h', name: 'The Hollies', isAdmin: false},
    ]
    const Layout = (await import('@/app/layout')).default
    render(await Layout({children: <div>picker</div>}))
    expect(screen.getByText('Bandstand')).toBeInTheDocument()
    expect(screen.queryByRole('link', {name: 'Songs'})).toBeNull()
  })

  it('titles pages with the band app name', async () => {
    bands = [{id: 'mb', name: 'Monkee Business', isAdmin: false}]
    const {generateMetadata} = await import('@/app/layout')
    const m: any = await generateMetadata()
    expect(m.title).toEqual({
      default: 'Monkee Wrench',
      template: '%s · Monkee Wrench',
    })
    expect(m.manifest).toBe('/manifest.webmanifest')
  })

  it('keeps the Rehearsals tab when the scheduling tool is off', async () => {
    bands = [{id: 'h', name: 'The Hollies', isAdmin: false}]
    const Layout = (await import('@/app/layout')).default
    render(await Layout({children: <div>x</div>}))
    expect(
      screen.getAllByRole('link', {name: 'Rehearsals'}).length,
    ).toBeGreaterThan(0)
  })
})
