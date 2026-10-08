'use client'

import Link from 'next/link'
import {usePathname} from 'next/navigation'
import {signOut, useSession} from 'next-auth/react'
import {ReactNode} from 'react'
import Dropdown from '@/components/Dropdown'
import ThemeToggle from '@/components/ThemeToggle'
import Avatar from '@/components/Avatar'

const TABS = [
  {href: '/songs', label: 'Songs'},
  {href: '/setlists', label: 'Setlists'},
  {href: '/rehearsals', label: 'Rehearsals'},
  {href: '/proposals', label: 'Proposals'},
]

/** What the header needs to know, worked out on the server per request. */
export type ShellBand = {
  /** "Monkee Wrench" for Monkee Business; Bandstand by default */
  appName: string
  /** The band on screen; null when none is chosen yet (or signed out) */
  band: {
    id: string
    name: string
    chat: {url: string; label: string} | null
    isAdmin: boolean
  } | null
  /** Every band they're in, for switching */
  bands: {id: string; name: string}[]
  isOwner: boolean
}

// Screens that take the whole display (performance mode) or stand alone
const BARE = [/^\/perform\//, /^\/login/]

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/')
}

async function switchTo(bandId: string) {
  const r = await fetch('/api/bands/current', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({bandId}),
  })
  // A full load: the layout (name, icon, menu) belongs to the band
  if (r.ok) window.location.assign('/songs')
}

export default function AppShell({
  ctx,
  children,
}: {
  ctx: ShellBand
  children: ReactNode
}) {
  const pathname = usePathname() ?? '/'
  const {data: session} = useSession()

  if (BARE.some((r) => r.test(pathname))) return <>{children}</>

  const name = session?.user?.name || session?.user?.email || ''
  const {band} = ctx
  const others = ctx.bands.filter((b) => b.id !== band?.id)
  const tabs = TABS
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="sticky top-0 z-30 border-b border-line bg-ink/95 backdrop-blur">
        <header className="flex items-center gap-4 px-4 py-2">
          <Link
            href={band ? '/songs' : '/bands'}
            className="text-[14px] font-extrabold uppercase tracking-[0.2em] no-underline"
          >
            {ctx.appName}
          </Link>
          <nav
            aria-label="Main"
            className={`hidden flex-1 gap-1 ${band ? 'md:flex' : ''}`}
          >
            {(band ? tabs : []).map((t) => {
              const on = isActive(pathname, t.href)
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  aria-current={on ? 'page' : undefined}
                  className={`rounded-lg px-3.5 py-2.5 no-underline ${on ? 'bg-text font-semibold text-ink' : 'text-muted hover:text-text'}`}
                >
                  {t.label}
                </Link>
              )
            })}
          </nav>
          <span className="flex-1 md:hidden" />
          <ThemeToggle />
          {session?.user && (
            <Dropdown
              label="Account menu"
              triggerClassName="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-panel font-bold"
              trigger={
                <Avatar name={name} src={session.user.image} size={36} />
              }
            >
              <p className="px-3 py-2 text-sm text-muted">
                {name}
                {band && ctx.bands.length > 1 && (
                  <span className="block text-xs text-faint">{band.name}</span>
                )}
              </p>
              {band && <MenuLink href="/activity">Recent changes</MenuLink>}
              {band?.chat && (
                <a
                  href={band.chat.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg px-3 py-2.5 no-underline hover:bg-line"
                >
                  {band.chat.label} ↗
                </a>
              )}
              <MenuLink href="/account">Account &amp; settings</MenuLink>
              {band?.isAdmin && (
                <MenuLink href="/members">Band members</MenuLink>
              )}
              {band?.isAdmin && <MenuLink href="/admin">Admin</MenuLink>}
              {ctx.isOwner && (
                <MenuLink href="/bands/manage">All bands</MenuLink>
              )}
              {others.length > 0 && (
                <div className="mt-1 border-t border-line pt-1">
                  <p className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-widest text-faint">
                    Switch band
                  </p>
                  {others.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => switchTo(b.id)}
                      className="block w-full rounded-lg px-3 py-2.5 text-left hover:bg-line"
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => signOut({callbackUrl: '/login'})}
                className="block w-full rounded-lg px-3 py-2.5 text-left hover:bg-line"
              >
                Sign out
              </button>
            </Dropdown>
          )}
        </header>
        {/* Phones: the tabs sit under the title bar, at the top (not a bottom bar) */}
        {band && (
          <nav
            aria-label="Main"
            className={`grid gap-1 px-2 pb-2 md:hidden grid-cols-4`}
          >
            {tabs.map((t) => {
              const on = isActive(pathname, t.href)
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  aria-current={on ? 'page' : undefined}
                  className={`flex min-h-11 items-center justify-center rounded-lg text-[13px] font-semibold no-underline ${on ? 'bg-text text-ink' : 'text-muted'}`}
                >
                  {t.label}
                </Link>
              )
            })}
          </nav>
        )}
      </div>

      <div className="flex-1">{children}</div>
    </div>
  )
}

function MenuLink({href, children}: {href: string; children: ReactNode}) {
  return (
    <Link
      href={href}
      className="block rounded-lg px-3 py-2.5 no-underline hover:bg-line"
    >
      {children}
    </Link>
  )
}
