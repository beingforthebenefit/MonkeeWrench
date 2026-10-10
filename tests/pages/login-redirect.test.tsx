import React from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {render, screen} from '@testing-library/react'
import {prismaMock} from '../prisma-mock'
import {safeCallback} from '@/lib/url'

let db: any
let session: any
const refresh = vi.fn()
vi.mock('@/lib/db', () => ({
  get prisma() {
    return db
  },
}))
vi.mock('next-auth', () => ({getServerSession: async () => session}))
vi.mock('@/lib/auth', () => ({authOptions: {}}))
vi.mock('@/lib/band', () => ({
  brandForRequest: async () => ({
    band: null,
    appName: 'Bandstand',
    iconUrl: '/i.png',
  }),
}))
vi.mock('@/lib/mail', () => ({mailConfigured: () => false}))
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`)
  },
  useRouter: () => ({replace: vi.fn(), refresh}),
  useSearchParams: () => new URLSearchParams(),
}))

beforeEach(() => {
  db = prismaMock()
  db.user.count.mockResolvedValue(3)
  session = null
  refresh.mockReset()
})

describe('the sign-in page', () => {
  it('signed in already: straight into the app, or where they were going', async () => {
    const Page = (await import('@/app/login/page')).default
    session = {user: {email: 'ana@x.com'}}
    db.user.findUnique.mockResolvedValue({id: 'u1'})
    await expect(Page({})).rejects.toThrow('REDIRECT /songs')
    await expect(
      Page({searchParams: {callbackUrl: '/setlists/l1'}}),
    ).rejects.toThrow('REDIRECT /setlists/l1')
    await expect(
      Page({searchParams: {callbackUrl: '//evil.example'}}),
    ).rejects.toThrow('REDIRECT /songs')
  })
  it('a session for an account that’s gone gets the form (no loop)', async () => {
    const Page = (await import('@/app/login/page')).default
    session = {user: {email: 'gone@x.com'}}
    render(await Page({}))
    expect(screen.getByRole('button', {name: 'Sign in'})).toBeInTheDocument()
  })
  it('a fresh install goes to setup', async () => {
    const Page = (await import('@/app/login/page')).default
    db.user.count.mockResolvedValue(0)
    await expect(Page({})).rejects.toThrow('REDIRECT /setup')
  })
})

describe('safeCallback', () => {
  it('only paths on this site', () => {
    expect(safeCallback('/songs/s1?v=2')).toBe('/songs/s1?v=2')
    for (const bad of [
      null,
      undefined,
      '',
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
    ])
      expect(safeCallback(bad)).toBe('/songs')
  })
})

describe('the loading placeholder', () => {
  it('says it’s busy', async () => {
    const Loading = (await import('@/app/(band)/loading')).default
    render(<Loading />)
    expect(screen.getByRole('main', {name: 'Loading'})).toHaveAttribute(
      'aria-busy',
      'true',
    )
  })
})
