import type {CalEvent} from './ics'
import {keyOf} from './availability'

export const SITE = (
  process.env.NEXTAUTH_URL ?? 'https://members.monkeebusinessband.com'
).replace(/\/$/, '')

export function rehearsalEvent(r: {
  id: string
  date: Date
  time: string | null
  place: string | null
  note: string | null
}): CalEvent {
  return {
    uid: `rehearsal-${r.id}@monkeewrench`,
    date: keyOf(r.date),
    time: r.time,
    title: 'Monkee Business rehearsal',
    location: r.place,
    description: [r.note, `Charts and setlists: ${SITE}/setlists`]
      .filter(Boolean)
      .join('\n'),
    url: `${SITE}/rehearsals`,
  }
}
