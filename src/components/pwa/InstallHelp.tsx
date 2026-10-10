'use client'

import {useEffect, useRef, useState} from 'react'
import type {PWAInstallElement} from '@khmyznikov/pwa-install'
import {DEMO} from '@/lib/demo'
import {InstallSteps} from './AppSettings'
import {
  canOfferInstall,
  install,
  INSTALL_HELP,
  isInstalled,
  onInstallOffer,
  platform,
} from './pwa'

/**
 * Getting the app onto the home screen, offered rather than left for people
 * to find in Account.
 *
 * - iPhone and iPad have no "Install" button for web apps: it's Share → Add
 *   to Home Screen, which hardly anyone finds by themselves. This shows how,
 *   with Apple's own look and the steps for the iOS version in hand (the
 *   Share button moved in iOS 26), and in an in-app browser (Gmail,
 *   Instagram) it says to open the page in Safari first.
 * - Android: Chrome's own install banner is held back (pwa.ts), so this card
 *   offers its install dialog instead; other browsers get the steps.
 *
 * It offers itself after the tour, then now and then (a few times at
 * most); "Show me how" in Account opens it any time.
 */

const OPEN = INSTALL_HELP
const ASKED = 'ms:install-asked'
const TIMES = 3
const APART = 7 * 24 * 60 * 60 * 1000

const DESCRIPTION =
  'Opens full screen, works on stage with no signal, and can tell you when a chart or setlist changes.'

/** A phone or tablet in a browser rather than the installed app. */
function which(): 'ios' | 'android' | null {
  if (DEMO || isInstalled()) return null
  const p = platform()
  return p === 'desktop' ? null : p
}

export function needsInstallHelp() {
  return which() !== null
}

/** Not too often: a few times, a week apart. */
function dueToAsk() {
  try {
    const {n, at} = JSON.parse(localStorage.getItem(ASKED) ?? '{"n":0,"at":0}')
    return n < TIMES && Date.now() - at > APART
  } catch {
    return false
  }
}

function asked() {
  try {
    const {n} = JSON.parse(localStorage.getItem(ASKED) ?? '{"n":0}')
    localStorage.setItem(ASKED, JSON.stringify({n: n + 1, at: Date.now()}))
  } catch {}
}

function touring() {
  try {
    return sessionStorage.getItem('ms:tour-step') !== null
  } catch {
    return false
  }
}

/** Show it when asked, after the tour, and on a later visit now and then. */
function useOffers(ready: boolean, tourDone: boolean, show: () => void) {
  const showRef = useRef(show)
  showRef.current = show
  useEffect(() => {
    if (!ready) return
    const open = () => showRef.current()
    const offer = () => {
      if (!dueToAsk()) return
      asked()
      showRef.current()
    }
    window.addEventListener(OPEN, open)
    // Straight after the tour (its last cards are about the app), or on a
    // later visit when no tour is running
    window.addEventListener('ms:tour-done', offer)
    const later =
      tourDone &&
      !touring() &&
      !new URLSearchParams(location.search).has('tour')
        ? setTimeout(offer, 4000)
        : undefined
    return () => {
      window.removeEventListener(OPEN, open)
      window.removeEventListener('ms:tour-done', offer)
      clearTimeout(later)
    }
  }, [ready, tourDone])
}

export default function InstallHelp({tourDone}: {tourDone: boolean}) {
  const [kind, setKind] = useState<'ios' | 'android' | null>(null)
  useEffect(() => setKind(which()), [])
  if (kind === 'ios') return <Apple tourDone={tourDone} />
  if (kind === 'android') return <Android tourDone={tourDone} />
  return null
}

function Apple({tourDone}: {tourDone: boolean}) {
  const [ready, setReady] = useState(false)
  const el = useRef<PWAInstallElement>(null)

  useEffect(() => {
    let gone = false
    import('@khmyznikov/pwa-install').then(() => !gone && setReady(true))
    return () => {
      gone = true
    }
  }, [])

  useOffers(ready, tourDone, () => el.current?.showDialog(true))

  if (!ready) return null
  return (
    <pwa-install
      ref={el}
      manual-apple="true"
      manual-chrome="true"
      disable-chrome="true"
      disable-screenshots="true"
      manifest-url="/manifest.webmanifest"
      install-description={DESCRIPTION}
    />
  )
}

function Android({tourDone}: {tourDone: boolean}) {
  const [open, setOpen] = useState(false)
  const [offer, setOffer] = useState(false)

  useEffect(() => {
    setOffer(canOfferInstall())
    return onInstallOffer(() => {
      setOffer(canOfferInstall())
      if (isInstalled()) setOpen(false)
    })
  }, [])

  useOffers(true, tourDone, () => setOpen(true))

  useEffect(() => {
    if (!open) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [open])

  if (!open) return null
  return (
    <div
      role="dialog"
      aria-labelledby="install-h"
      className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-line-2 bg-panel px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 text-text shadow-2xl"
    >
      <div className="mx-auto max-w-md">
        <h2 id="install-h" className="text-lg font-extrabold">
          Add the app to your home screen
        </h2>
        <p className="mt-1 text-[15px] leading-snug text-muted">
          {DESCRIPTION}
        </p>
        {!offer && <InstallSteps plat="android" />}
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="min-h-11 px-2 text-sm text-muted underline"
          >
            {offer ? 'Not now' : 'Close'}
          </button>
          <span className="flex-1" />
          {offer && (
            <button
              type="button"
              onClick={async () => {
                if (await install()) setOpen(false)
              }}
              className="min-h-11 rounded-lg bg-accent px-5 font-bold text-on-accent"
            >
              Install
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
