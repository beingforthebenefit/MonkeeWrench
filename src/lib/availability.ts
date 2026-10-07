/**
 * Rehearsal availability. Like the old sheet, people record when they CAN'T
 * make it; no entry means free. "PM out" means out in the afternoon only, so
 * still available for an evening rehearsal.
 */

export type Kind = 'OUT' | 'PM_OUT'
export type Member = {id: string; name: string; answered: boolean}
export type Entry = {userId: string; date: string; kind: Kind}

const TZ = 'America/Los_Angeles'

/** Today's date in the band's time zone, as YYYY-MM-DD. */
export function todayKey(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {timeZone: TZ}).format(now)
}

export function addDays(key: string, n: number) {
  const d = new Date(key + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function dayRange(from: string, count: number) {
  return Array.from({length: count}, (_, i) => addDays(from, i))
}

/** Date column (UTC midnight) → YYYY-MM-DD */
export function keyOf(d: Date) {
  return d.toISOString().slice(0, 10)
}

export type DayScore = {
  date: string
  free: number
  total: number
  out: string[]
  pmOut: string[]
  unanswered: string[]
}

/** Score each day: how many can make an evening rehearsal, and who can't. */
export function scoreDays(
  days: string[],
  members: Member[],
  entries: Entry[],
): DayScore[] {
  const byDay = new Map<string, Map<string, Kind>>()
  for (const e of entries) {
    if (!byDay.has(e.date)) byDay.set(e.date, new Map())
    byDay.get(e.date)!.set(e.userId, e.kind)
  }
  return days.map((date) => {
    const marks = byDay.get(date) ?? new Map<string, Kind>()
    const out = members
      .filter((m) => marks.get(m.id) === 'OUT')
      .map((m) => m.name)
    const pmOut = members
      .filter((m) => marks.get(m.id) === 'PM_OUT')
      .map((m) => m.name)
    const unanswered = members.filter((m) => !m.answered).map((m) => m.name)
    // Only people who have answered count as free: silence isn't a yes
    const free = members.filter(
      (m) => m.answered && marks.get(m.id) !== 'OUT',
    ).length
    return {
      date,
      free,
      total: members.length,
      out,
      pmOut,
      unanswered,
    }
  })
}

/** The best days: most people free, then fewest afternoon conflicts, then soonest. */
export function bestDays(scores: DayScore[], limit = 3) {
  return [...scores]
    .sort(
      (a, b) =>
        b.free - a.free ||
        a.pmOut.length - b.pmOut.length ||
        a.date.localeCompare(b.date),
    )
    .slice(0, limit)
}

const dayFmt = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})
const dowFmt = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  timeZone: 'UTC',
})

export function formatDay(key: string) {
  return dayFmt.format(new Date(key + 'T00:00:00Z'))
}
export function weekday(key: string) {
  return dowFmt.format(new Date(key + 'T00:00:00Z'))
}
