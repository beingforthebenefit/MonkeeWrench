'use client'

import Link from 'next/link'
import {usePathname} from 'next/navigation'
import {useEffect, useState} from 'react'

const key = (bandId: string) => `ms:invite-nudge:${bandId}`

/**
 * A band with only its first member: the first thing to do is add the rest.
 * Shown to its admins until someone joins or they dismiss it (on this
 * device).
 */
export default function InviteNudge({
  bandId,
  emails,
}: {
  bandId: string
  /** Adding someone emails them a link (else the admin sends a password) */
  emails: boolean
}) {
  const pathname = usePathname() ?? ''
  // Hidden until we know it wasn't dismissed, so it never flashes
  const [show, setShow] = useState(false)
  useEffect(() => {
    try {
      setShow(localStorage.getItem(key(bandId)) !== '1')
    } catch {
      setShow(true)
    }
  }, [bandId])
  // Not on Members itself, where the adding happens
  if (!show || pathname.startsWith('/members')) return null
  function dismiss() {
    setShow(false)
    try {
      localStorage.setItem(key(bandId), '1')
    } catch {}
  }
  return (
    <p className="mx-auto mt-3 max-w-[1400px] px-4 md:px-7">
      <span
        role="status"
        className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-amber/50 bg-panel px-4 py-3"
      >
        <span className="min-w-0 flex-1">
          <strong>Your band is ready. Add your bandmates</strong>{' '}
          <span className="text-muted">
            {emails
              ? 'so they see the charts too: each gets an email to choose a password.'
              : 'so they see the charts too: you’ll make each a password to send them.'}
          </span>
        </span>
        <Link
          href="/members"
          className="inline-flex min-h-10 items-center rounded-lg bg-accent px-4 font-bold text-on-accent no-underline"
        >
          Add members
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="min-h-10 px-1 text-muted"
        >
          ✕
        </button>
      </span>
    </p>
  )
}
