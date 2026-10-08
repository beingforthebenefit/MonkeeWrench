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

// The band's Discord server (carried over from the old nav)
const DISCORD_URL = 'https://discord.com/channels/1347070995122622545'

// Screens that take the whole display (performance mode) or stand alone
const BARE = [/^\/perform\//, /^\/login/]

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/')
}

export default function AppShell({children}: {children: ReactNode}) {
  const pathname = usePathname() ?? '/'
  const {data: session} = useSession()

  if (BARE.some((r) => r.test(pathname))) return <>{children}</>

  const name = session?.user?.name || session?.user?.email || ''
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="sticky top-0 z-30 border-b border-line bg-ink/95 backdrop-blur">
        <header className="flex items-center gap-4 px-4 py-2">
          <Link
            href="/songs"
            className="text-[14px] font-extrabold uppercase tracking-[0.2em] no-underline"
          >
            Monkee Wrench
          </Link>
          <nav aria-label="Main" className="hidden flex-1 gap-1 md:flex">
            {TABS.map((t) => {
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
              <p className="px-3 py-2 text-sm text-muted">{name}</p>
              <MenuLink href="/activity">Recent changes</MenuLink>
              <a
                href={DISCORD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg px-3 py-2.5 no-underline hover:bg-line"
              >
                Band Discord ↗
              </a>
              <MenuLink href="/account">Photo &amp; password</MenuLink>
              {session.user.isAdmin && (
                <MenuLink href="/members">Band members</MenuLink>
              )}
              {session.user.isAdmin && <MenuLink href="/admin">Admin</MenuLink>}
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
        <nav
          aria-label="Main"
          className="grid grid-cols-4 gap-1 px-2 pb-2 md:hidden"
        >
          {TABS.map((t) => {
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
