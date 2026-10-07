import {describe, it, expect} from 'vitest'
import {
  addDays,
  bestDays,
  nextAllFree,
  dayRange,
  scoreDays,
  todayKey,
  type Member,
} from '@/lib/availability'

const members: Member[] = [
  {id: 'ed', name: 'Ed', answered: true},
  {id: 'mi', name: 'Mischelle', answered: true},
  {id: 'mk', name: 'Mark', answered: false},
]

describe('dates', () => {
  it('uses the band time zone for today', () => {
    // 2026-10-08 05:00 UTC is still Oct 7 in California
    expect(todayKey(new Date('2026-10-08T05:00:00Z'))).toBe('2026-10-07')
  })
  it('adds days across month ends', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
    expect(dayRange('2026-10-30', 3)).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ])
  })
})

describe('scoreDays / bestDays', () => {
  const days = ['2026-10-09', '2026-10-10', '2026-10-11']
  const scores = scoreDays(days, members, [
    {userId: 'mi', date: '2026-10-09', kind: 'OUT'},
    {userId: 'mi', date: '2026-10-11', kind: 'PM_OUT'},
  ])

  it('counts only people who answered as free', () => {
    expect(scores.map((s) => s.free)).toEqual([1, 2, 2])
    expect(scores[0].out).toEqual(['Mischelle'])
    expect(scores[0].unanswered).toEqual(['Mark'])
  })

  it('treats afternoon-out as free for an evening rehearsal but ranks it lower', () => {
    expect(scores[2].pmOut).toEqual(['Mischelle'])
    expect(bestDays(scores).map((s) => s.date)).toEqual([
      '2026-10-10',
      '2026-10-11',
      '2026-10-09',
    ])
  })
})

describe('prefer not / next days everyone can make', () => {
  const days = dayRange('2026-10-20', 40)
  const scores = scoreDays(days, members, [
    {userId: 'ed', date: '2026-10-20', kind: 'OUT'},
    {userId: 'mi', date: '2026-10-21', kind: 'PREFER_NOT'},
    {userId: 'mi', date: '2026-10-22', kind: 'PM_OUT'},
    ...dayRange('2026-10-23', 30).map((date) => ({
      userId: 'ed',
      date,
      kind: 'OUT' as const,
    })),
  ])

  it('counts prefer-not as available but names them', () => {
    expect(scores[1].free).toBe(2)
    expect(scores[1].preferNot).toEqual(['Mischelle'])
  })

  it('lists the next days with nobody out, however far ahead', () => {
    expect(nextAllFree(scores, 3).map((s) => s.date)).toEqual([
      '2026-10-21',
      '2026-10-22',
      '2026-11-22',
    ])
  })
})
