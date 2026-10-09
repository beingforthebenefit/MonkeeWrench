import type {CalEvent} from './ics'
import {keyOf} from './availability'
import {formatClock, parseClock, runningOrder, timeRange} from './gig'
import {SITE} from './rehearsal-events'

type GigSetlist = {
  id: string
  name: string
  gigDate: Date | null
  startTime: string | null
  venue: string | null
  notes: string | null
  items: {
    kind: 'SONG' | 'SET' | 'BREAK'
    label: string | null
    minutes: number | null
    startTime: string | null
    song: {seconds: number | null} | null
  }[]
}

/**
 * A gig (a setlist with a date) as a calendar event: from its start time to
 * the end of its last set when the sets' lengths are known (otherwise the
 * calendar's usual three hours), at its venue, with each set's times.
 */
export function gigEvent(
  s: GigSetlist,
  band: {name: string; timezone: string},
  site: string = SITE,
): CalEvent | null {
  if (!s.gigDate) return null
  const {sets} = runningOrder(s.startTime, s.items)
  const start = parseClock(s.startTime)
  // Sets with a planned length are the gig; an "Extras (if needed)" set
  // without one shouldn't stretch it
  const planned = sets.some((x) => x.minutes != null)
    ? sets.filter((x) => x.minutes != null)
    : sets
  const end = [...planned].reverse().find((x) => x.end != null)?.end ?? null
  const hhmm = (m: number) =>
    `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  // "14:00–17:20" reads as a start and an end; a start alone gets 3 hours
  const time =
    start == null
      ? null
      : end != null
        ? `${hhmm(start)}–${hhmm(end)}`
        : hhmm(start)
  const setTimes = planned
    .filter((x) => x.label && x.start != null)
    .map((x) => `${x.label} ${timeRange(x.start, x.end)}`)
  return {
    uid: `gig-${s.id}@bandstand`,
    date: keyOf(s.gigDate),
    time,
    title: `${band.name}: ${s.name}`,
    location: s.venue,
    description: [
      s.startTime
        ? `Starts ${formatClock(Number(s.startTime.slice(0, 2)) * 60 + Number(s.startTime.slice(3, 5)), true)}`
        : null,
      setTimes.length ? setTimes.join('\n') : null,
      s.notes,
      `Setlist: ${site}/setlists/${s.id}`,
    ]
      .filter(Boolean)
      .join('\n'),
    url: `${site}/setlists/${s.id}`,
    tz: band.timezone,
  }
}
