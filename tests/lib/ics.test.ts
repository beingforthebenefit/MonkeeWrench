import {describe, it, expect} from 'vitest'
import {buildIcs, googleCalendarUrl, parseTimes} from '@/lib/ics'

describe('parseTimes', () => {
  it('reads ranges, single times and meridiems', () => {
    expect(parseTimes('3:00–6:00 PM')).toEqual({start: '15:00', end: '18:00'})
    expect(parseTimes('3-6pm')).toEqual({start: '15:00', end: '18:00'})
    expect(parseTimes('7pm')).toEqual({start: '19:00', end: '22:00'})
    expect(parseTimes('10:30am to 1pm')).toEqual({start: '10:30', end: '13:00'})
    expect(parseTimes('7')).toEqual({start: '19:00', end: '22:00'})
    expect(parseTimes('12pm')).toEqual({start: '12:00', end: '15:00'})
  })
  it('is all-day when there is no time', () => {
    expect(parseTimes(null)).toBeNull()
    expect(parseTimes('afternoon')).toBeNull()
  })
})

const ev = {
  uid: 'r1@monkeewrench',
  date: '2026-10-24',
  time: '3:00–6:00 PM',
  title: 'Monkee Business rehearsal',
  location: 'Soundwave Studios (Big Stage Room), 2200 Wood St, Oakland',
  description: '3-hour session; setlist: Oct 24',
  url: 'https://members.monkeebusinessband.com/rehearsals',
}

describe('buildIcs', () => {
  const ics = buildIcs([ev], {
    now: new Date('2026-10-07T12:00:00Z'),
    name: 'Monkee Business rehearsals',
  })
  it('writes a local-time event with the band time zone', () => {
    expect(ics).toContain('DTSTART;TZID=America/Los_Angeles:20261024T150000')
    expect(ics).toContain('DTEND;TZID=America/Los_Angeles:20261024T180000')
    expect(ics).toContain('BEGIN:VTIMEZONE')
    expect(ics).toContain('X-WR-CALNAME:Monkee Business rehearsals')
  })
  it('escapes commas and semicolons, folds long lines, uses CRLF', () => {
    expect(ics).toContain(
      'LOCATION:Soundwave Studios (Big Stage Room)\\, 2200 Wood St\\, Oaklan',
    )
    expect(ics).toContain('3-hour session\; setlist: Oct 24')
    expect(ics.split('\r\n').every((l) => Buffer.byteLength(l) <= 75)).toBe(
      true,
    )
  })
  it('makes all-day events when there is no time', () => {
    const allDay = buildIcs([{...ev, time: null}])
    expect(allDay).toContain('DTSTART;VALUE=DATE:20261024')
    expect(allDay).toContain('DTEND;VALUE=DATE:20261025')
  })
})

describe('googleCalendarUrl', () => {
  it('prefills the event in the band time zone', () => {
    const u = new URL(googleCalendarUrl(ev))
    expect(u.searchParams.get('dates')).toBe('20261024T150000/20261024T180000')
    expect(u.searchParams.get('ctz')).toBe('America/Los_Angeles')
    expect(u.searchParams.get('location')).toContain('Soundwave')
  })
})
