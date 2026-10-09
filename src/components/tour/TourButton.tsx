'use client'

import {startTour} from './Tour'

export default function TourButton() {
  return (
    <button
      type="button"
      onClick={startTour}
      className="inline-flex min-h-11 items-center rounded-lg bg-accent px-5 font-bold text-on-accent"
    >
      Take the tour
    </button>
  )
}
