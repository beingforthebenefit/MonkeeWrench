'use client'

import {useState} from 'react'
import {googleCalendarUrl} from '@/lib/ics'
import Dropdown from '@/components/Dropdown'

type R = {
  id: string
  date: string
  time: string | null
  place: string | null
  note: string | null
}

const SITE = typeof window === 'undefined' ? '' : window.location.origin

/** "Add to calendar" for one rehearsal: an .ics file or a Google link. */
export function AddToCalendar({r}: {r: R}) {
  const google = googleCalendarUrl({
    uid: r.id,
    date: r.date,
    time: r.time,
    title: 'Monkee Business rehearsal',
    location: r.place,
    description: [r.note, `Charts and setlists: ${SITE}/setlists`]
      .filter(Boolean)
      .join('\n'),
  })
  return (
    <Dropdown
      trigger="Add to calendar ▾"
      align="left"
      triggerClassName="flex min-h-9 items-center text-sm font-semibold text-sky"
      panelClassName="w-60"
    >
      <a
        href={`/api/rehearsals/${r.id}/ics`}
        className="block rounded-lg px-3 py-2.5 no-underline hover:bg-line"
      >
        Apple Calendar / Outlook
        <span className="block text-xs text-faint">Downloads an .ics file</span>
      </a>
      <a
        href={google}
        target="_blank"
        rel="noreferrer"
        className="block rounded-lg px-3 py-2.5 no-underline hover:bg-line"
      >
        Google Calendar ↗
      </a>
    </Dropdown>
  )
}

/**
 * A personal feed of every rehearsal. Calendar apps check it on their own,
 * so new and changed rehearsals appear without anyone adding them.
 */
export function SubscribeCalendar() {
  const [url, setUrl] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  async function show() {
    setOpen(!open)
    if (url || open) return
    const r = await fetch('/api/account/calendar')
    const {url: existing} = await r.json()
    if (existing) setUrl(existing)
    else await make()
  }
  async function make() {
    setBusy(true)
    const r = await fetch('/api/account/calendar', {method: 'POST'})
    setUrl((await r.json()).url)
    setCopied(false)
    setBusy(false)
  }
  const webcal = url?.replace(/^https?:/, 'webcal:')

  return (
    <div className="mt-3 border-t border-line pt-3">
      <button
        type="button"
        onClick={show}
        aria-expanded={open}
        className="min-h-9 text-sm font-semibold text-sky"
      >
        Subscribe to all rehearsals {open ? '▴' : '▾'}
      </button>
      {open && (
        <div className="mt-2 space-y-3 text-sm">
          <p className="text-muted">
            New rehearsals then show up in your calendar by themselves. This
            link is yours: don’t share it.
          </p>
          {url ? (
            <>
              <div className="flex flex-wrap gap-2">
                <a
                  href={webcal}
                  className="inline-flex min-h-11 items-center rounded-lg bg-accent px-4 font-bold text-on-accent no-underline"
                >
                  Apple Calendar / Outlook
                </a>
                <a
                  href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal ?? '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center rounded-lg border border-line-2 px-4 no-underline"
                >
                  Google Calendar ↗
                </a>
              </div>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={url}
                  aria-label="Calendar link"
                  className="min-h-10 min-w-0 flex-1 rounded-lg border border-line-2 bg-ink px-2 font-mono text-xs text-muted"
                  onFocus={(e) => e.target.select()}
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(url)
                      setCopied(true)
                    } catch {}
                  }}
                  className="min-h-10 rounded-lg border border-line-2 px-3"
                >
                  {copied ? 'Copied ✓' : 'Copy'}
                </button>
              </div>
              <button
                type="button"
                onClick={make}
                disabled={busy}
                className="min-h-9 text-xs text-faint underline"
              >
                Reset link (stops the old one working)
              </button>
            </>
          ) : (
            <p className="text-faint">Making your link…</p>
          )}
        </div>
      )}
    </div>
  )
}
