import {describe, it, expect} from 'vitest'
import {
  formatClock,
  parseLength,
  runningOrder,
  schedule,
  setSummary,
  timeRange,
} from '@/lib/gig'

const song = (seconds: number | null) => ({kind: 'SONG' as const, seconds})

describe('gig schedule', () => {
  it('times sets and breaks from the start time', () => {
    const {sets, breaks} = schedule('20:00', [
      {kind: 'SET', label: 'Set 1', minutes: 45, startTime: null},
      song(180),
      song(200),
      {kind: 'BREAK', minutes: 15},
      {kind: 'SET', label: 'Set 2', minutes: 40, startTime: null},
      song(150),
    ])
    expect(sets.map((s) => timeRange(s.start, s.end))).toEqual([
      '8:00–8:45',
      '9:00–9:40',
    ])
    expect(timeRange(breaks[0].start, breaks[0].end)).toBe('8:45–9:00')
    expect(sets[0]).toMatchObject({songs: 2, seconds: 380, unknown: 0})
  })

  it("a set with no length runs as long as its songs, once they're all known", () => {
    const {sets} = schedule('20:00', [
      {kind: 'SET', label: 'Set 1', minutes: null, startTime: null},
      song(150),
      song(160),
    ])
    expect(timeRange(sets[0].start, sets[0].end)).toBe('8:00–8:06')
    const unknown = schedule('20:00', [
      {kind: 'SET', label: 'Set 1', minutes: null, startTime: null},
      song(150),
      song(null),
    ])
    expect(timeRange(unknown.sets[0].start, unknown.sets[0].end)).toBe(
      'from 8:00',
    )
  })

  it('lets a set keep its own start time', () => {
    const {sets} = schedule('20:00', [
      {kind: 'SET', label: 'Set 1', minutes: 45, startTime: null},
      {kind: 'SET', label: 'Late set', minutes: 30, startTime: '22:30'},
    ])
    expect(timeRange(sets[1].start, sets[1].end)).toBe('10:30–11:00')
  })

  it('says when a set runs over its slot', () => {
    const {sets} = schedule(null, [
      {kind: 'SET', label: 'Set 1', minutes: 5, startTime: null},
      song(200),
      song(200),
    ])
    expect(setSummary(sets[0])).toBe('2 songs · ~7 min · 2 over')
  })

  it('numbers songs within their set', () => {
    const items = [
      {kind: 'SET' as const, label: 'Set 1', minutes: 45},
      {kind: 'SONG' as const, song: {seconds: 100}},
      {kind: 'SONG' as const, song: {seconds: 100}},
      {kind: 'BREAK' as const, minutes: 15},
      {kind: 'SET' as const, label: 'Set 2', minutes: 45},
      {kind: 'SONG' as const, song: {seconds: 100}},
    ]
    const {entries, divided} = runningOrder('19:30', items)
    expect(divided).toBe(true)
    expect(
      entries.map((e) => (e.kind === 'SONG' ? `${e.set}.${e.n}` : e.kind)),
    ).toEqual(['SET', '0.1', '0.2', 'BREAK', 'SET', '1.1'])
  })

  it('treats a gig with no sets as one undivided list', () => {
    const {divided, sets} = runningOrder(null, [
      {kind: 'SONG' as const, song: {seconds: null}},
    ])
    expect(divided).toBe(false)
    expect(sets).toHaveLength(1)
  })

  it('reads and writes lengths and clock times', () => {
    expect(parseLength('3:12')).toBe(192)
    expect(parseLength('')).toBeNull()
    expect(parseLength('3.12')).toBeUndefined()
    expect(formatClock(20 * 60, true)).toBe('8:00 PM')
    expect(formatClock(24 * 60 + 30)).toBe('12:30')
  })
})
