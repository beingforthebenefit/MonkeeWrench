/**
 * Rehearsal availability. Like the old sheet, people record when they CAN'T
 * make it; no entry means free. "PM out" means out in the afternoon only, so
 * still available for an evening rehearsal. "Prefer not" means they can make
 * it if they have to but would rather another day.
 */

export type Kind = 'OUT' | 'PM_OUT' | 'PREFER_NOT'
export type Member = {
  id: string
  name: string
  answered: boolean
  avatar?: string | null
}
export type Entry = {userId: string; date: string; kind: Kind}

/**
 * Busy with another band: a rehearsal or gig there, which counts here
 * without anyone marking it. `label` is what this viewer may see ("Rehearsal
 * with The Hollies", or "Busy with another band" when they aren't in it).
 */
export type Block = {
  userId: string
  date: string
  kind: 'OUT' | 'PM_OUT'
  label: string
}

const RANK: Record<Kind, number> = {PREFER_NOT: 1, PM_OUT: 2, OUT: 3}

/** Marks with other-band blocks folded in: the stronger one wins. */
export function withBlocks(entries: Entry[], blocks: Block[]): Entry[] {
  if (!blocks.length) return entries
  const at = new Map(entries.map((e) => [`${e.userId}|${e.date}`, e]))
  for (const b of blocks) {
    const k = `${b.userId}|${b.date}`
    const e = at.get(k)
    if (!e || RANK[b.kind] > RANK[e.kind])
      at.set(k, {userId: b.userId, date: b.date, kind: b.kind})
  }
  return [...at.values()]
}

/** The stronger of two marks (for merging per-band marks into shared). */
export function stronger(a: Kind, b: Kind): Kind {
  return RANK[a] >= RANK[b] ? a : b
}

/** Today's date in the band's time zone, as YYYY-MM-DD. */
export function todayKey(now = new Date(), tz = 'America/Los_Angeles') {
  return new Intl.DateTimeFormat('en-CA', {timeZone: tz}).format(now)
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
  preferNot: string[]
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
    const preferNot = members
      .filter((m) => marks.get(m.id) === 'PREFER_NOT')
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
      preferNot,
      unanswered,
    }
  })
}

/**
 * The next days nobody has marked Out, soonest first, however far ahead.
 * Afternoon-only and prefer-not days still count: the caller shows who.
 */
export function nextAllFree(scores: DayScore[], limit = 5) {
  return scores.filter((s) => s.out.length === 0).slice(0, limit)
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
