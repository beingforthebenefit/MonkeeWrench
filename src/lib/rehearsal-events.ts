import type {CalEvent} from './ics'
import {keyOf} from './availability'

export const SITE = (
  process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
).replace(/\/$/, '')

/**
 * One rehearsal as a calendar event. `site` is the band's own address, so
 * the links in it open the right band's pages.
 */
export function rehearsalEvent(
  r: {
    id: string
    date: Date
    time: string | null
    place: string | null
    note: string | null
  },
  band: {name: string; timezone: string},
  site: string = SITE,
): CalEvent {
  return {
    // The suffix predates multi-band; changing it would duplicate events
    // already in people's calendars
    uid: `rehearsal-${r.id}@bandstand`,
    date: keyOf(r.date),
    time: r.time,
    title: `${band.name} rehearsal`,
    location: r.place,
    description: [r.note, `Charts and setlists: ${site}/setlists`]
      .filter(Boolean)
      .join('\n'),
    url: `${site}/rehearsals`,
    tz: band.timezone,
  }
}
