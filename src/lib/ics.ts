/**
 * Calendar events for rehearsals: .ics (Apple Calendar, Outlook, and the
 * subscribable feed) and Google Calendar links. Times are local to the band
 * (its time zone, America/Los_Angeles unless set); a rehearsal's time is free
 * text, so it is read here.
 */

export const TZ = 'America/Los_Angeles'
const DEFAULT_HOURS = 3

export type CalEvent = {
  uid: string
  date: string // YYYY-MM-DD
  time: string | null
  title: string
  location: string | null
  description: string | null
  url?: string | null
  /** The band's IANA time zone; default TZ */
  tz?: string
}

/** Minutes east of UTC that `tz` is at the instant `ms`. */
function offsetMinutes(tz: string, ms: number) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value]),
  )
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
  )
  return Math.round((asUtc - ms) / 60_000)
}

/** A wall-clock date + time in `tz` as a UTC timestamp: 20261024T220000Z. */
export function utcStamp(date: string, time: string, tz: string) {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  const wall = Date.UTC(y, mo - 1, d, h, mi)
  // Twice: the first guess can land on the other side of a DST change
  let ms = wall - offsetMinutes(tz, wall) * 60_000
  ms = wall - offsetMinutes(tz, ms) * 60_000
  return new Date(ms)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
}

/**
 * "3:00–6:00 PM" → {start: '15:00', end: '18:00'}; "7pm" → 19:00 + 3h.
 * A time without am/pm takes the next one given ("3-6 PM"), else is taken
 * as pm (bands rarely rehearse at 7 in the morning). null = all day.
 */
export function parseTimes(
  text: string | null,
): {start: string; end: string} | null {
  if (!text) return null
  const re = /(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/gi
  const found: {h: number; m: number; ap: string | null}[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) && found.length < 2) {
    const h = Number(m[1])
    if (h < 1 || h > 23) continue
    found.push({
      h,
      m: Number(m[2] ?? 0),
      ap: m[3] ? m[3][0].toLowerCase() : null,
    })
  }
  if (!found.length) return null
  const last = found[found.length - 1].ap
  const to24 = ({h, m, ap}: {h: number; m: number; ap: string | null}) => {
    const mer = ap ?? last ?? 'p'
    let hh = h
    if (h <= 12) {
      if (mer === 'p' && h !== 12) hh = h + 12
      if (mer === 'a' && h === 12) hh = 0
    }
    return hh * 60 + m
  }
  const start = to24(found[0])
  let end = found[1] ? to24(found[1]) : start + DEFAULT_HOURS * 60
  if (end <= start) end = start + DEFAULT_HOURS * 60
  const fmt = (mins: number) =>
    `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
  return {start: fmt(start), end: fmt(Math.min(end, 23 * 60 + 59))}
}

const compactDate = (d: string) => d.replace(/-/g, '')
const compactTime = (t: string) => t.replace(':', '') + '00'

function nextDay(d: string) {
  const x = new Date(d + 'T00:00:00Z')
  x.setUTCDate(x.getUTCDate() + 1)
  return x.toISOString().slice(0, 10)
}

function escapeText(s: string) {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** RFC 5545 line folding: at most 75 octets per line. */
function fold(line: string) {
  const bytes = Buffer.from(line, 'utf8')
  if (bytes.length <= 75) return line
  const parts: string[] = []
  let start = 0
  while (start < bytes.length) {
    let end = Math.min(start + (start === 0 ? 75 : 74), bytes.length)
    // don't split a UTF-8 character
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--
    parts.push(bytes.subarray(start, end).toString('utf8'))
    start = end
  }
  return parts.join('\r\n ')
}

const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  `TZID:${TZ}`,
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:-0800',
  'TZOFFSETTO:-0700',
  'TZNAME:PDT',
  'DTSTART:19700308T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:-0700',
  'TZOFFSETTO:-0800',
  'TZNAME:PST',
  'DTSTART:19701101T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
]

function stamp(now: Date) {
  return now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
}

export function buildIcs(
  events: CalEvent[],
  opts: {name?: string; now?: Date} = {},
) {
  const now = stamp(opts.now ?? new Date())
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Bandstand//Bandstand//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...(opts.name
      ? [`X-WR-CALNAME:${escapeText(opts.name)}`, `X-WR-TIMEZONE:${TZ}`]
      : []),
    ...VTIMEZONE,
  ]
  for (const e of events) {
    const t = parseTimes(e.time)
    const tz = e.tz ?? TZ
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${now}`,
      ...(t && tz === TZ
        ? [
            `DTSTART;TZID=${TZ}:${compactDate(e.date)}T${compactTime(t.start)}`,
            `DTEND;TZID=${TZ}:${compactDate(e.date)}T${compactTime(t.end)}`,
          ]
        : t
          ? [
              // Other zones in UTC, which needs no VTIMEZONE block
              `DTSTART:${utcStamp(e.date, t.start, tz)}`,
              `DTEND:${utcStamp(e.date, t.end, tz)}`,
            ]
          : [
              `DTSTART;VALUE=DATE:${compactDate(e.date)}`,
              `DTEND;VALUE=DATE:${compactDate(nextDay(e.date))}`,
            ]),
      `SUMMARY:${escapeText(e.title)}`,
      ...(e.location ? [`LOCATION:${escapeText(e.location)}`] : []),
      ...(e.description ? [`DESCRIPTION:${escapeText(e.description)}`] : []),
      ...(e.url ? [`URL:${e.url}`] : []),
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}

/** A "create event" link that opens Google Calendar prefilled. */
export function googleCalendarUrl(e: CalEvent) {
  const t = parseTimes(e.time)
  const dates = t
    ? `${compactDate(e.date)}T${compactTime(t.start)}/${compactDate(e.date)}T${compactTime(t.end)}`
    : `${compactDate(e.date)}/${compactDate(nextDay(e.date))}`
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates,
    ctz: e.tz ?? TZ,
    ...(e.location ? {location: e.location} : {}),
    ...(e.description || e.url
      ? {details: [e.description, e.url].filter(Boolean).join('\n\n')}
      : {}),
  })
  return `https://calendar.google.com/calendar/render?${q}`
}
