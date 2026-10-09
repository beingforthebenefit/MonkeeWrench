'use client'

import {startTour} from '@/components/tour/Tour'

/**
 * Across the top of every page of the public demo: whose band this is, that
 * nothing saves, and the way back to the product page.
 */
export default function DemoStrip() {
  return (
    <p className="mx-auto mt-3 max-w-[1400px] px-4 md:px-7">
      <span className="block rounded-lg border border-amber/40 bg-panel px-4 py-2 text-sm text-muted">
        <strong className="text-text">Demo</strong> — The Riverside Five is a
        made-up band. Look around; nothing you change is saved.{' '}
        <button type="button" onClick={startTour} className="text-amber">
          Take the tour
        </button>{' '}
        ·{' '}
        {/* The product page shares the demo's site: a full load, not a route */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="text-amber">
          About Bandstand
        </a>
      </span>
    </p>
  )
}
