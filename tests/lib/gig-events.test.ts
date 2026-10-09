import {describe, it, expect} from 'vitest'
import {gigEvent} from '@/lib/gig-events'
import {buildIcs} from '@/lib/ics'

const band = {name: 'The Riverside Five', timezone: 'America/Los_Angeles'}
const song = (seconds: number) => ({
  kind: 'SONG' as const,
  label: null,
  minutes: null,
  startTime: null,
  song: {seconds},
})

describe('gigEvent', () => {
  const gig = {
    id: 'g1',
    name: 'Riverside Park',
    gigDate: new Date('2026-10-18T00:00:00Z'),
    startTime: '14:00',
    venue: 'Riverside Park bandstand',
    notes: 'Load in 1:15',
    items: [
      {
        kind: 'SET' as const,
        label: 'Set 1',
        minutes: 45,
        startTime: null,
        song: null,
      },
      song(200),
      {
        kind: 'BREAK' as const,
        label: null,
        minutes: 15,
        startTime: null,
        song: null,
      },
      {
        kind: 'SET' as const,
        label: 'Set 2',
        minutes: 45,
        startTime: null,
        song: null,
      },
      song(180),
    ],
  }

  it('runs from the start to the end of the last set, with the set times', () => {
    const e = gigEvent(gig, band, 'https://band.example')!
    expect(e.date).toBe('2026-10-18')
    expect(e.time).toBe('14:00–15:45')
    expect(e.title).toBe('The Riverside Five: Riverside Park')
    expect(e.location).toBe('Riverside Park bandstand')
    expect(e.description).toContain('Set 1 2:00–2:45')
    expect(e.description).toContain('Set 2 3:00–3:45')
    expect(e.url).toBe('https://band.example/setlists/g1')
    expect(buildIcs([e], {name: 'x'})).toContain(
      'DTSTART;TZID=America/Los_Angeles:20261018T140000',
    )
  })

  it('ends with the last planned set, not an extras set after it', () => {
    const e = gigEvent(
      {
        ...gig,
        items: [
          ...gig.items,
          {
            kind: 'SET' as const,
            label: 'Extras',
            minutes: null,
            startTime: null,
            song: null,
          },
          song(600),
        ],
      },
      band,
    )!
    expect(e.time).toBe('14:00–15:45')
    expect(e.description).not.toContain('Extras')
  })

  it('is all day without a start time, and skipped without a date', () => {
    expect(gigEvent({...gig, startTime: null}, band)!.time).toBeNull()
    expect(gigEvent({...gig, gigDate: null}, band)).toBeNull()
  })
})
