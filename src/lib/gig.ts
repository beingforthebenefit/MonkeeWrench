/**
 * A gig's running order: songs, divided into sets, with breaks between.
 * The rows are one ordered list — a SET row starts a set, a BREAK row is a
 * break — so reordering anything is one drag. Times are worked out here
 * from the gig's start time, each set's length and each break's length; a
 * set can also be given its own start time ("Set 2 at 9:30").
 */

export type GigRow =
  | {kind: 'SONG'; seconds: number | null}
  | {
      kind: 'SET'
      label: string
      minutes: number | null
      startTime: string | null
    }
  | {kind: 'BREAK'; minutes: number | null}

export type SetInfo = {
  /** Index of the SET row (or -1 for songs before any set) */
  row: number
  label: string
  /** Minutes after midnight; null when there's no time to go on */
  start: number | null
  end: number | null
  songs: number
  /** Total of the songs' lengths that are known, and how many aren't */
  seconds: number
  unknown: number
  /** The planned length, if given */
  minutes: number | null
}

export type BreakInfo = {
  row: number
  minutes: number | null
  start: number | null
  end: number | null
}

/** "20:00" → 1200; anything else → null. */
export function parseClock(t: string | null | undefined) {
  const m = t?.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  return h < 24 && min < 60 ? h * 60 + min : null
}

/** 1200 → "8:00", 1290 → "9:30"; `ampm` adds " PM". */
export function formatClock(mins: number, ampm = false) {
  const m = ((mins % 1440) + 1440) % 1440
  const h24 = Math.floor(m / 60)
  const h = h24 % 12 || 12
  const t = `${h}:${String(m % 60).padStart(2, '0')}`
  return ampm ? `${t} ${h24 < 12 ? 'AM' : 'PM'}` : t
}

/** 192 → "3:12". */
export function formatLength(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/** "3:12" or "192" → 192; blank → null; nonsense → undefined. */
export function parseLength(text: string): number | null | undefined {
  const t = text.trim()
  if (!t) return null
  const m = t.match(/^(\d{1,2}):([0-5]\d)$/)
  if (m) return Number(m[1]) * 60 + Number(m[2])
  return /^\d{1,4}$/.test(t) ? Number(t) : undefined
}

/** "~41 min" for a set's songs (rounded up: better early than over). */
export function roughMinutes(seconds: number) {
  return Math.ceil(seconds / 60)
}

/**
 * Sets and breaks with their times. A set runs for its planned length; with
 * none, for its songs' known length. The next thing starts when the last
 * one ends, unless a set has its own start time.
 */
export function schedule(gigStart: string | null, rows: GigRow[]) {
  const sets: SetInfo[] = []
  const breaks: BreakInfo[] = []
  let clock = parseClock(gigStart)
  let cur: SetInfo | null = null

  const close = () => {
    if (!cur) return
    const length =
      cur.minutes ??
      (cur.songs && !cur.unknown ? roughMinutes(cur.seconds) : null)
    cur.end = cur.start != null && length != null ? cur.start + length : null
    clock = cur.end
  }

  rows.forEach((r, row) => {
    if (r.kind === 'SET') {
      close()
      const own = parseClock(r.startTime)
      cur = {
        row,
        label: r.label,
        start: own ?? clock,
        end: null,
        songs: 0,
        seconds: 0,
        unknown: 0,
        minutes: r.minutes,
      }
      sets.push(cur)
    } else if (r.kind === 'BREAK') {
      close()
      cur = null
      const start = clock
      const end = start != null && r.minutes != null ? start + r.minutes : null
      breaks.push({row, minutes: r.minutes, start, end})
      clock = end
    } else {
      if (!cur) {
        // Songs before the first set header: a set with no name
        cur = {
          row: -1,
          label: '',
          start: clock,
          end: null,
          songs: 0,
          seconds: 0,
          unknown: 0,
          minutes: null,
        }
        sets.push(cur)
      }
      cur.songs++
      if (r.seconds != null) cur.seconds += r.seconds
      else cur.unknown++
    }
  })
  close()
  return {sets, breaks}
}

/** "8:00–8:45", "from 8:00", or "" with no times. */
export function timeRange(start: number | null, end: number | null) {
  if (start == null) return ''
  return end == null
    ? `from ${formatClock(start)}`
    : `${formatClock(start)}–${formatClock(end)}`
}

/**
 * One line about a set's songs against its slot: "11 songs · ~41 min",
 * "~52 min · 7 over", "9 songs · 3 without a length".
 */
export function setSummary(s: SetInfo) {
  const parts = [`${s.songs} song${s.songs === 1 ? '' : 's'}`]
  if (s.seconds) {
    const total = roughMinutes(s.seconds)
    parts.push(`~${total} min`)
    if (s.minutes && !s.unknown && total > s.minutes)
      parts.push(`${total - s.minutes} over`)
  }
  if (s.unknown && s.seconds) parts.push(`${s.unknown} without a length`)
  return parts.join(' · ')
}

type OrderItem = {
  kind: 'SONG' | 'SET' | 'BREAK'
  label?: string | null
  minutes?: number | null
  startTime?: string | null
  song?: {seconds?: number | null} | null
}

export type OrderEntry<T> =
  /** n: number within its set; set: index into `sets` */
  | {kind: 'SONG'; item: T; n: number; set: number}
  | {kind: 'SET'; item: T; info: SetInfo}
  | {kind: 'BREAK'; item: T; info: BreakInfo}

/** The rows with their times, and each song's number within its set. */
export function runningOrder<T extends OrderItem>(
  gigStart: string | null,
  items: T[],
) {
  const rows: GigRow[] = items.map((i) =>
    i.kind === 'SET'
      ? {
          kind: 'SET',
          label: i.label ?? 'Set',
          minutes: i.minutes ?? null,
          startTime: i.startTime ?? null,
        }
      : i.kind === 'BREAK'
        ? {kind: 'BREAK', minutes: i.minutes ?? null}
        : {kind: 'SONG', seconds: i.song?.seconds ?? null},
  )
  const {sets, breaks} = schedule(gigStart, rows)
  const setAt = new Map(sets.map((s, n) => [s.row, n]))
  const breakAt = new Map(breaks.map((b) => [b.row, b]))
  let set = sets.length && sets[0].row === -1 ? 0 : -1
  let n = 0
  const entries: OrderEntry<T>[] = items.map((item, row) => {
    if (item.kind === 'SET') {
      set = setAt.get(row)!
      n = 0
      return {kind: 'SET', item, info: sets[set]}
    }
    if (item.kind === 'BREAK')
      return {kind: 'BREAK', item, info: breakAt.get(row)!}
    return {kind: 'SONG', item, n: ++n, set: Math.max(set, 0)}
  })
  // Sets are worth showing only when the gig is actually divided
  const divided = sets.some((s) => s.row >= 0)
  return {entries, sets, breaks, divided}
}
