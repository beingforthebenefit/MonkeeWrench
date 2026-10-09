'use client'

import {useEffect, useState} from 'react'
import {
  canOfferInstall,
  currentSubscription,
  install,
  isInstalled,
  onInstallOffer,
  platform,
  pushSupported,
  turnOff,
  turnOn,
  type Platform,
} from './pwa'

type Kind =
  | 'notifyCharts'
  | 'notifySetlists'
  | 'notifyRehearsals'
  | 'notifyProposals'

const KINDS: {key: Kind; title: string; hint: string}[] = [
  {
    key: 'notifyCharts',
    title: 'Songs and charts',
    hint: 'A chart edited, a song added',
  },
  {
    key: 'notifySetlists',
    title: 'Setlists',
    hint: 'A gig’s set changed or added',
  },
  {
    key: 'notifyRehearsals',
    title: 'Rehearsals',
    hint: 'One scheduled or cancelled',
  },
  {
    key: 'notifyProposals',
    title: 'Proposals',
    hint: 'A song proposed, or voted in',
  },
]

/**
 * The app on this device: installing it to the home screen, and
 * notifications. On an iPhone or iPad, notifications only work in the
 * installed app, so outside it this explains how to install instead of
 * offering a switch that can't work.
 */
export default function AppSettings({
  initial,
  devices,
  ready,
}: {
  initial: Record<Kind, boolean>
  /** The devices this person has turned notifications on for */
  devices: string[]
  /** The server can send notifications (its keys are set) */
  ready: boolean
}) {
  const [mounted, setMounted] = useState(false)
  const [plat, setPlat] = useState<Platform>('desktop')
  const [installed, setInstalled] = useState(false)
  const [offer, setOffer] = useState(false)
  const [supported, setSupported] = useState(false)
  const [on, setOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [kinds, setKinds] = useState(initial)

  useEffect(() => {
    setPlat(platform())
    setInstalled(isInstalled())
    setSupported(pushSupported())
    setOffer(canOfferInstall())
    currentSubscription().then((s) => setOn(Boolean(s)))
    setMounted(true)
    return onInstallOffer(() => {
      setOffer(canOfferInstall())
      setInstalled(isInstalled())
    })
  }, [])

  async function toggle() {
    setBusy(true)
    setNote(null)
    if (on) {
      await turnOff()
      setOn(false)
    } else {
      const r = await turnOn()
      if (r === 'on') setOn(true)
      else if (r === 'denied')
        setNote(
          plat === 'ios'
            ? 'Notifications are blocked. Turn them on in Settings → Notifications → this app, then try again.'
            : 'Notifications are blocked for this site. Allow them in the browser’s site settings (the icon by the address), then try again.',
        )
      else setNote('This device can’t do notifications.')
    }
    setBusy(false)
  }

  async function test() {
    setNote(null)
    const r = await fetch('/api/push/test', {method: 'POST'})
    const {sent} = await r.json()
    setNote(
      sent
        ? 'Sent — it should arrive in a moment.'
        : 'Nothing was sent: no device has notifications on.',
    )
  }

  async function setKind(key: Kind) {
    const next = {...kinds, [key]: !kinds[key]}
    setKinds(next)
    const r = await fetch('/api/account/settings', {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({[key]: next[key]}),
    })
    if (!r.ok) setKinds(kinds)
  }

  if (!mounted) return null
  const needsInstall = plat === 'ios' && !installed

  return (
    <section
      id="notifications"
      aria-labelledby="app-h"
      className="mt-8 scroll-mt-24"
    >
      <h2
        id="app-h"
        className="text-xs font-bold uppercase tracking-widest text-muted"
      >
        The app on this device
      </h2>

      {/* Install */}
      {!installed && (
        <div className="mt-2 border-t border-line py-3">
          <p className="font-semibold">Add it to your home screen</p>
          <p className="text-sm text-muted">
            It opens full screen like an app, works without signal for anything
            you’ve opened, and can send notifications.
          </p>
          {offer && plat !== 'ios' ? (
            <button
              type="button"
              onClick={async () => setInstalled(await install())}
              className="mt-2 min-h-11 rounded-lg bg-accent px-4 font-bold text-on-accent"
            >
              Install app
            </button>
          ) : (
            <InstallSteps plat={plat} />
          )}
        </div>
      )}

      {/* Notifications */}
      <div className="border-t border-line py-3">
        {needsInstall ? (
          <>
            <p className="font-semibold">Notifications</p>
            <p className="text-sm text-muted">
              On an iPhone or iPad, notifications come through the app on your
              home screen. Add it there (above), open it from the home screen,
              and turn them on here.
            </p>
          </>
        ) : !supported || !ready ? (
          <>
            <p className="font-semibold">Notifications</p>
            <p className="text-sm text-muted">
              {!ready
                ? 'Notifications aren’t set up on this server yet.'
                : 'This browser can’t show notifications. Try Chrome, Edge, Firefox or Safari.'}
            </p>
          </>
        ) : (
          <>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={on}
                disabled={busy}
                onChange={toggle}
                className="mt-1 h-5 w-5 shrink-0"
              />
              <span>
                <span className="block font-semibold">
                  Notifications on this device
                </span>
                <span className="block text-sm text-muted">
                  {on
                    ? 'You’ll hear when someone else changes something — never about your own changes. A burst of edits comes as one.'
                    : 'Get told when someone else changes a chart, a setlist, a rehearsal or a proposal.'}
                </span>
              </span>
            </label>
            {on && (
              <button
                type="button"
                onClick={test}
                className="ml-8 mt-2 min-h-9 rounded-lg border border-line-2 px-3 text-sm"
              >
                Send a test
              </button>
            )}
          </>
        )}
        {note && (
          <p role="status" className="mt-2 text-sm text-amber">
            {note}
          </p>
        )}
      </div>

      {/* What to hear about: per person, every device */}
      {(on || (devices.length > 0 && !needsInstall)) && (
        <div className="border-t border-line py-3">
          <p className="font-semibold">Tell me about</p>
          <ul className="mt-1">
            {KINDS.map((k) => (
              <li key={k.key}>
                <label className="flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={kinds[k.key]}
                    onChange={() => setKind(k.key)}
                    className="h-5 w-5 shrink-0"
                  />
                  <span>
                    {k.title}{' '}
                    <span className="text-sm text-muted">· {k.hint}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {devices.length > 0 && (
            <p className="mt-1 text-sm text-muted">
              On for: {devices.join(', ')}
            </p>
          )}
        </div>
      )}
    </section>
  )
}

/** How to add it to the home screen, for the browser in hand. */
export function InstallSteps({plat}: {plat: Platform}) {
  if (plat === 'ios')
    return (
      <ol className="mt-2 list-decimal pl-5 text-sm">
        <li>
          In Safari, tap <b>Share</b>{' '}
          <span aria-hidden>(the square with an arrow ↑)</span>.
        </li>
        <li>
          Choose <b>Add to Home Screen</b>, then <b>Add</b>.
        </li>
        <li>Open it from your home screen from now on.</li>
      </ol>
    )
  if (plat === 'android')
    return (
      <ol className="mt-2 list-decimal pl-5 text-sm">
        <li>
          In Chrome, tap the <b>⋮</b> menu.
        </li>
        <li>
          Choose <b>Install app</b> (or <b>Add to home screen</b>).
        </li>
      </ol>
    )
  return (
    <p className="mt-2 text-sm">
      In Chrome or Edge, use the <b>install</b> icon at the right of the address
      bar (or the menu → <b>Install</b>). Safari on a Mac: File →{' '}
      <b>Add to Dock</b>.
    </p>
  )
}
