'use client'

import Link from 'next/link'
import {usePathname} from 'next/navigation'
import {signOut, useSession} from 'next-auth/react'
import {ReactNode, useState} from 'react'

const TABS = [
  {href: '/songs', label: 'Songs'},
  {href: '/setlists', label: 'Setlists'},
  {href: '/rehearsals', label: 'Rehearsals'},
  {href: '/vote', label: 'Proposals'},
]

// Screens that take the whole display (performance mode) or stand alone
const BARE = [/^\/perform\//, /^\/login/]

function isActive(pathname: string, href: string) {
  if (href === '/vote')
    return pathname.startsWith('/vote') || pathname.startsWith('/propose')
  return pathname === href || pathname.startsWith(href + '/')
}

export default function AppShell({children}: {children: ReactNode}) {
  const pathname = usePathname() ?? '/'
  const {data: session} = useSession()
  const [menuOpen, setMenuOpen] = useState(false)

  if (BARE.some((r) => r.test(pathname))) return <>{children}</>

  const name = session?.user?.name || session?.user?.email || ''
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-line bg-ink/95 px-4 py-2 backdrop-blur">
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
        {session?.user && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-label="Account menu"
              className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-panel font-bold"
            >
              {session.user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={session.user.image}
                  alt=""
                  className="h-9 w-9 rounded-full"
                />
              ) : (
                name.charAt(0).toUpperCase()
              )}
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-line-2 bg-panel p-2 shadow-xl">
                <p className="px-3 py-2 text-sm text-muted">{name}</p>
                <Link
                  href="/activity"
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-lg px-3 py-2.5 no-underline hover:bg-line"
                >
                  Recent changes
                </Link>
                {session.user.isAdmin && (
                  <Link
                    href="/admin"
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-lg px-3 py-2.5 no-underline hover:bg-line"
                  >
                    Admin
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => signOut({callbackUrl: '/login'})}
                  className="block w-full rounded-lg px-3 py-2.5 text-left hover:bg-line"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      <div className="flex-1 pb-24 md:pb-0">{children}</div>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-ink pb-[max(env(safe-area-inset-bottom),8px)] pt-1.5 md:hidden"
      >
        {TABS.map((t) => {
          const on = isActive(pathname, t.href)
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={on ? 'page' : undefined}
              className={`flex min-h-[52px] flex-col items-center justify-center gap-1 text-xs font-semibold no-underline ${on ? 'text-amber' : 'text-muted'}`}
            >
              <span
                className={`h-1 w-6 rounded ${on ? 'bg-amber' : 'bg-transparent'}`}
              />
              {t.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
