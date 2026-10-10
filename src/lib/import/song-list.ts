import type {SongIn} from '../band-import-schema'

/** CSV (or tab-separated) into rows, with quoted fields and "" escapes */
export function parseCsv(text: string): string[][] {
  const sep =
    (text.split('\n')[0].match(/\t/g)?.length ?? 0) >
    (text.split('\n')[0].match(/,/g)?.length ?? 0)
      ? '\t'
      : ','
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"' && !cell) quoted = true
    else if (c === sep) {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  if (cell || row.length) rows.push([...row, cell])
  return rows.filter((r) => r.some((c) => c.trim()))
}

const COLUMNS: [keyof SongIn | 'length', RegExp][] = [
  ['title', /^(song( title| name)?|title|name|track)$/i],
  ['writer', /^(artist|writer|by|composer|original( artist)?|band)$/i],
  ['leadSinger', /^(lead( singer| vocals?)?|singer|vocals?|sung by)$/i],
  ['length', /^(length|duration|time|mins?|minutes)$/i],
  ['youtubeUrl', /^(youtube|video|link|url|recording)$/i],
  ['notes', /^(notes?|comments?)$/i],
  ['status', /^(status|ready|state)$/i],
]

/** "3:45" → 225; "4" (minutes) → 240 */
export function readLength(v: string): number | null {
  const t = v.trim()
  const ms = t.match(/^(\d{1,3}):([0-5]\d)$/)
  if (ms) return +ms[1] * 60 + +ms[2]
  if (/^\d+(\.\d+)?$/.test(t)) return Math.round(parseFloat(t) * 60)
  return null
}

/**
 * A spreadsheet of songs (File → Download → CSV): one row a song, the
 * columns named on the first row. Only a title column is needed; the songs
 * come in without charts, to add later.
 */
export function readSongList(text: string): SongIn[] {
  const rows = parseCsv(text)
  if (rows.length < 2) return []
  const head = rows[0].map((h) => h.trim())
  const at = new Map<string, number>()
  for (const [field, re] of COLUMNS) {
    const i = head.findIndex((h) => re.test(h))
    if (i >= 0 && !at.has(field)) at.set(field, i)
  }
  if (!at.has('title')) return []
  const get = (r: string[], f: string) =>
    at.has(f) ? (r[at.get(f)!] ?? '').trim() || null : null
  const seen = new Set<string>()
  const songs: SongIn[] = []
  for (const r of rows.slice(1)) {
    const title = get(r, 'title')
    if (!title || seen.has(title.toLowerCase())) continue
    seen.add(title.toLowerCase())
    const youtube = get(r, 'youtubeUrl')
    const status = get(r, 'status')
    songs.push({
      title: title.slice(0, 200),
      writer: get(r, 'writer'),
      leadSinger: get(r, 'leadSinger'),
      seconds: readLength(get(r, 'length') ?? ''),
      youtubeUrl: youtube && /^https?:\/\//.test(youtube) ? youtube : null,
      notes: get(r, 'notes'),
      ...(status && {
        status: /^(ready|yes|y|gig|true|x|✓|done)/i.test(status)
          ? ('READY' as const)
          : ('LEARNING' as const),
      }),
      chart: null,
    })
  }
  return songs
}
