'use client'

import {useEffect, useRef, useState} from 'react'
import type {PWAInstallElement} from '@khmyznikov/pwa-install'
import {DEMO} from '@/lib/demo'
import {isInstalled, platform} from './pwa'

/**
 * iPhone and iPad have no "Install" button for web apps: it's Share → Add
 * to Home Screen, which hardly anyone finds by themselves. This shows how,
 * with Apple's own look and the steps for the iOS version in hand (the
 * Share button moved in iOS 26), and in an in-app browser (Gmail,
 * Instagram) it says to open the page in Safari first.
 *
 * It offers itself after the tour, then now and then (a few times at
 * most); "Show me how" in Account opens it any time.
 */

const OPEN = 'ms:install-help'
const ASKED = 'ms:install-asked'
const TIMES = 3
const APART = 7 * 24 * 60 * 60 * 1000

/** Open the steps (Account's "Show me how"). */
export function showInstallHelp() {
  window.dispatchEvent(new Event(OPEN))
}

/** An iPhone or iPad, in a browser rather than the installed app. */
export function needsInstallHelp() {
  return !DEMO && platform() === 'ios' && !isInstalled()
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

export default function IosInstall({tourDone}: {tourDone: boolean}) {
  const [ready, setReady] = useState(false)
  const el = useRef<PWAInstallElement>(null)

  useEffect(() => {
    if (!needsInstallHelp()) return
    let gone = false
    import('@khmyznikov/pwa-install').then(() => !gone && setReady(true))
    return () => {
      gone = true
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    const show = () => el.current?.showDialog(true)
    const offer = () => {
      if (!dueToAsk()) return
      asked()
      show()
    }
    window.addEventListener(OPEN, show)
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
      window.removeEventListener(OPEN, show)
      window.removeEventListener('ms:tour-done', offer)
      clearTimeout(later)
    }
  }, [ready, tourDone])

  if (!ready) return null
  return (
    <pwa-install
      ref={el}
      manual-apple="true"
      manual-chrome="true"
      disable-chrome="true"
      disable-screenshots="true"
      manifest-url="/manifest.webmanifest"
      install-description="Opens full screen, works on stage with no signal, and can tell you when a chart or setlist changes."
    />
  )
}
