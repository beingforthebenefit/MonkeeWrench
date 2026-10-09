'use client'

import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react'
import {usePathname, useRouter} from 'next/navigation'
import {STEPS, type TourStep} from './steps'
import {DEMO} from '@/lib/demo'

/** Start the tour from anywhere (the menu, the help page). */
export function startTour() {
  window.dispatchEvent(new Event('ms:tour'))
}

const KEY = 'ms:tour-step'
// The public demo can't save that someone took the tour: their browser
// remembers instead, so it opens once per visitor, not on every page load
const DEMO_DONE = 'ms:tour-done'

function doneHere() {
  try {
    return DEMO && localStorage.getItem(DEMO_DONE) === '1'
  } catch {
    return false
  }
}

/**
 * A walk through the app on the real screens: the screen dims except the
 * thing being explained, with a card pointing at it. Shown once, the first
 * time someone signs in; "Take the tour" (menu, Help) or ?tour on any page
 * starts it again.
 */
export default function Tour({auto}: {auto: boolean}) {
  const router = useRouter()
  const pathname = usePathname() ?? '/'
  const [step, setStep] = useState<number | null>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [missing, setMissing] = useState(false)

  // Survives the page changes the tour itself makes
  const go = useCallback((n: number | null) => {
    try {
      if (n === null) sessionStorage.removeItem(KEY)
      else sessionStorage.setItem(KEY, String(n))
    } catch {
      // private mode: the tour still runs on this page
    }
    setStep(n)
  }, [])

  useEffect(() => {
    let saved: number | null = null
    try {
      const v = sessionStorage.getItem(KEY)
      saved = v === null ? null : Number(v)
    } catch {}
    const asked = new URLSearchParams(window.location.search).has('tour')
    if (saved !== null && !Number.isNaN(saved)) setStep(saved)
    else if (asked || (auto && pathname === '/songs' && !doneHere())) go(0)
    const start = () => {
      if (window.location.pathname !== '/songs') router.push('/songs')
      go(0)
    }
    window.addEventListener('ms:tour', start)
    return () => window.removeEventListener('ms:tour', start)
    // Once per mount: later page changes are the tour's own
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const finish = useCallback(() => {
    go(null)
    if (DEMO)
      try {
        localStorage.setItem(DEMO_DONE, '1')
      } catch {}
    // Off the sample pages, back to the band's own songs
    if (window.location.pathname.startsWith('/tour/')) router.push('/songs')
    fetch('/api/account/settings', {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({tourDone: true}),
    }).catch(() => {})
  }, [go, router])

  const current: TourStep | null = step === null ? null : (STEPS[step] ?? null)

  // Find what the step points at (it may still be rendering), bring it into
  // view, and follow it as the page moves
  useLayoutEffect(() => {
    setRect(null)
    setMissing(false)
    if (!current) return
    if (current.path && !current.path.test(pathname)) return
    if (!current.target) return
    let tries = 0
    let el: Element | null = null
    let follow: ReturnType<typeof setInterval> | undefined
    let opening: ReturnType<typeof setTimeout> | undefined
    const find = () => visible(current.target!)
    // The thing, and what it opened (a chord's diagram), lit up together
    const measure = () => {
      if (!el) return
      const r = el.getBoundingClientRect()
      const extra = current.also ? visible(current.also) : null
      setRect((old) => {
        const next = extra ? union(r, extra.getBoundingClientRect()) : r
        return old && same(old, next) ? old : next
      })
    }
    const timer = setInterval(() => {
      el = find()
      if (el) {
        clearInterval(timer)
        el.scrollIntoView({block: 'center', behavior: 'instant'})
        measure()
        // Show it working: open it once the page has stopped moving (a
        // scroll puts a chord's diagram away)
        if (current.open)
          opening = setTimeout(() => {
            const o = visible(current.open!)
            if (o instanceof HTMLElement) o.click()
          }, 200)
        // What opens grows as it draws
        follow = setInterval(measure, 150)
      } else if (++tries > 25) {
        clearInterval(timer)
        setMissing(true)
      }
    }, 120)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      clearInterval(timer)
      clearInterval(follow)
      clearTimeout(opening)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [current, pathname])

  // A step whose thing isn't on this page (a song with no notation): skip
  // it, the way you were going
  const heading = useRef<1 | -1>(1)
  useEffect(() => {
    if (!missing || step === null) return
    const n = step + heading.current
    go(n >= 0 && n < STEPS.length ? n : null)
  }, [missing, step, go])

  const next = () => {
    if (step === null) return
    heading.current = 1
    let n = step + 1
    // Steps on this page whose thing isn't here (no notation in this song)
    while (
      n < STEPS.length &&
      STEPS[n].target &&
      !STEPS[n].from &&
      !STEPS[n].href &&
      (!STEPS[n].path || STEPS[n].path!.test(pathname)) &&
      !visible(STEPS[n].target!)
    )
      n++
    if (n >= STEPS.length) return finish()
    const to = STEPS[n]
    // The next step is on another page: follow the link it names
    if (to.path && !to.path.test(pathname)) {
      const href =
        to.href ?? (to.from && visible(to.from)?.getAttribute('href'))
      if (href) router.push(href)
    }
    go(n)
  }
  const back = () => {
    if (!step) return
    heading.current = -1
    let n = step - 1
    // Back past steps on this page whose thing isn't here (no notation)
    while (
      n > 0 &&
      STEPS[n].target &&
      (!STEPS[n].path || STEPS[n].path!.test(pathname)) &&
      !visible(STEPS[n].target!)
    )
      n--
    const to = STEPS[n]
    if (to.path && !to.path.test(pathname)) router.back()
    go(n)
  }

  if (!current || step === null) return null
  if (current.path && !current.path.test(pathname)) return null
  if (current.target && !rect) return null

  const pad = 8
  const hole = rect && {
    x: rect.left - pad,
    y: rect.top - pad,
    w: rect.width + pad * 2,
    h: rect.height + pad * 2,
  }
  // The card goes below what it points at, or above it near the bottom
  const vw = typeof window === 'undefined' ? 400 : window.innerWidth
  const vh = typeof window === 'undefined' ? 800 : window.innerHeight
  const width = Math.min(340, vw - 24)
  const below = hole ? hole.y + hole.h + 220 < vh || hole.y < 240 : true
  const left = hole
    ? Math.min(Math.max(12, hole.x + hole.w / 2 - width / 2), vw - width - 12)
    : (vw - width) / 2
  const arrowX = hole
    ? Math.min(Math.max(20, hole.x + hole.w / 2 - left), width - 20)
    : 0

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-label="Tour">
      <svg className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <mask id="tour-hole">
            <rect width="100%" height="100%" fill="white" />
            {hole && (
              <rect
                x={hole.x}
                y={hole.y}
                width={hole.w}
                height={hole.h}
                rx={12}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(10,10,12,0.72)"
          mask="url(#tour-hole)"
        />
        {hole && (
          <rect
            x={hole.x}
            y={hole.y}
            width={hole.w}
            height={hole.h}
            rx={12}
            fill="none"
            stroke="var(--color-amber)"
            strokeWidth={3}
          />
        )}
      </svg>
      <div
        className="absolute rounded-2xl border border-line-2 bg-panel p-4 text-text shadow-2xl"
        style={{
          width,
          left,
          ...(hole
            ? below
              ? {top: hole.y + hole.h + 14}
              : {bottom: vh - hole.y + 14}
            : {top: '50%', transform: 'translateY(-50%)'}),
        }}
      >
        {hole && (
          <span
            aria-hidden
            className="absolute h-3 w-3 rotate-45 border-line-2 bg-panel"
            style={{
              left: arrowX - 6,
              ...(below
                ? {top: -7, borderLeftWidth: 1, borderTopWidth: 1}
                : {bottom: -7, borderRightWidth: 1, borderBottomWidth: 1}),
            }}
          />
        )}
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-sky">
          {step + 1} of {STEPS.length}
        </p>
        <h2 className="mt-1 text-lg font-extrabold">{current.title}</h2>
        <p className="mt-1.5 text-[15px] leading-snug text-muted">
          {current.body}
        </p>
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={finish}
            className="min-h-11 px-2 text-sm text-muted underline"
          >
            {step + 1 === STEPS.length ? 'Close' : 'Skip tour'}
          </button>
          <span className="flex-1" />
          {step > 0 && (
            <button
              type="button"
              onClick={back}
              className="min-h-11 rounded-lg border border-line-2 px-4"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={next}
            className="min-h-11 rounded-lg bg-accent px-5 font-bold text-on-accent"
          >
            {step + 1 === STEPS.length ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}

function union(a: DOMRect, b: DOMRect) {
  const left = Math.min(a.left, b.left)
  const top = Math.min(a.top, b.top)
  return new DOMRect(
    left,
    top,
    Math.max(a.right, b.right) - left,
    Math.max(a.bottom, b.bottom) - top,
  )
}

function same(a: DOMRect, b: DOMRect) {
  return (
    a.left === b.left &&
    a.top === b.top &&
    a.width === b.width &&
    a.height === b.height
  )
}

/**
 * The first match that's actually on screen (the header has two navs);
 * several selectors are tried in order.
 */
function visible(selectors: string | string[]) {
  for (const selector of Array.isArray(selectors) ? selectors : [selectors])
    for (const el of Array.from(document.querySelectorAll(selector))) {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) return el
    }
  return null
}
