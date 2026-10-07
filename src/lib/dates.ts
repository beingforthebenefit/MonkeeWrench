const TZ = 'America/Los_Angeles'

const sameYear = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: TZ,
})
const otherYear = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
  timeZone: TZ,
})
const full = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: TZ,
})

/** "Oct 5" this year, "Aug 2025" otherwise — for "edited by X · <date>". */
export function shortDate(d: Date | string, now = new Date()) {
  const date = new Date(d)
  return date.getFullYear() === now.getFullYear()
    ? sameYear.format(date)
    : otherYear.format(date)
}

export function fullDate(d: Date | string) {
  return full.format(new Date(d))
}

export function isRecent(d: Date | string, days = 7, now = new Date()) {
  return now.getTime() - new Date(d).getTime() < days * 86_400_000
}
