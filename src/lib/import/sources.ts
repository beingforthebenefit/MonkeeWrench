import {strFromU8, unzipSync} from 'fflate'
import type {SetlistIn, SongIn} from '../band-import-schema'
import {BandImport} from '../band-import-schema'
import {docxText} from './docx'
import {readOnSongLibrary, type Library, type SqlDb} from './onsong-library'
import {readSongList} from './song-list'

/**
 * Everything dropped on the Import page, turned into songs and setlists to
 * review: an OnSong backup, OnSong or text files, ChordPro, Word files
 * (Google Drive's Download), a zip of any of those, a spreadsheet's CSV, or
 * a Bandstand export. All of it read here, on the device.
 */

export type Found = {
  id: string
  title: string
  /** Where it came from: a file name, "OnSong" */
  from: string
  song: SongIn
}
export type FoundSet = {
  id: string
  setlist: SetlistIn
  /** The Found ids of its songs, so choosing a set chooses them */
  songIds: string[]
}
export type FoundBook = {id: string; name: string; songIds: string[]}
export type Skipped = {name: string; why: string}
export type Findings = {
  songs: Found[]
  sets: FoundSet[]
  books: FoundBook[]
  skipped: Skipped[]
  rehearsals: BandImport['rehearsals']
  /** An OnSong library: big, so nothing is chosen until asked */
  library: boolean
}

export type FileIn = {name: string; bytes: Uint8Array}
/** Opens SQLite bytes (sql.js in the browser, a fake in tests) */
export type OpenSqlite = (bytes: Uint8Array) => Promise<SqlDb>

export const empty = (): Findings => ({
  songs: [],
  sets: [],
  books: [],
  skipped: [],
  rehearsals: [],
  library: false,
})

const CHORDPRO = /\.(cho|chopro|chordpro|crd|pro)$/i
const TEXT = /\.(onsong|txt|text)$/i
const UNREADABLE: [RegExp, string][] = [
  [/\.pdf$/i, 'PDF charts can’t be read: export the song as text or Word'],
  [
    /\.(doc|rtf|pages|odt)$/i,
    'Save it as a Word (.docx) or text file and add that',
  ],
  [/\.(jpe?g|png|gif|heic|webp|tiff?)$/i, 'A picture, not a chart'],
  [/\.(mp3|m4a|wav|aiff?|mp4|mov)$/i, 'A recording, not a chart'],
]

const base = (name: string) => name.split('/').pop()!
/** "Don_t Call On Me.docx" → "Don't Call On Me": Drive swaps ' for _ */
export function titleFromFile(name: string) {
  return base(name)
    .replace(/\.[^.]+$/, '')
    .replace(/(\w)_(s|t|ll|re|ve|d|m)\b/gi, "$1'$2")
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

const NOT_A_BYLINE =
  /^\s*(intro|outro|verse|chorus|bridge|solo|key|capo|tempo|count|riff|vamp|piano|organ|guitar|bass|drums|horns?|sax|e\.? ?piano)\b|^[A-G][#b]?(m|maj|min|sus|dim|aug|add|\d|\/)*(\s+[A-G][#b]?(m|maj|min|sus|dim|aug|add|\d|\/)*)*\s*$|[[\]{}|]/i
/**
 * Who a song is by, from OnSong's byline or a file's second line, when it
 * is that: "Blind Melon | E-Chords" is Blind Melon; "Intro: C Am F G",
 * "Capo 3" and a row of chords are the chart, not an artist.
 */
export function cleanByline(v: string | null | undefined): string | null {
  const t = (v ?? '').split(' | ')[0].trim()
  if (!t || t.length > 80 || NOT_A_BYLINE.test(t)) return null
  return t
}

let seq = 0
const nextId = (p: string) => `${p}${++seq}`

/** A ChordPro file: its {title} and {artist}, or the file's name */
export function fromChordPro(name: string, text: string): Found {
  const dir = (k: string) =>
    text
      .match(
        new RegExp(`^\\s*\\{\\s*(?:${k})\\s*:\\s*(.*?)\\s*\\}\\s*$`, 'im'),
      )?.[1]
      ?.trim() || null
  const title = dir('title|t') ?? titleFromFile(name)
  return {
    id: nextId('f'),
    title,
    from: base(name),
    song: {
      title,
      writer: dir('artist|composer|subtitle|st'),
      chart: {chordpro: text},
    },
  }
}

const META_LINE =
  /^\s*(key|tempo|time|capo|duration|ccli|copyright|artist|author|bpm)\s*:/i
/**
 * An OnSong file, or any plain-text chart: the title on the first line,
 * often the artist on the second, "Key: G" somewhere on top.
 */
export function fromOnSongText(name: string, text: string): Found {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const top = lines.filter((l) => l.trim()).slice(0, 6)
  if (/^\s*\{/.test(top[0] ?? '') && /\{\s*(title|t)\s*:/i.test(text))
    return fromChordPro(name, text)
  const first = top[0]?.trim() ?? ''
  const looksLikeTitle =
    first &&
    first.length <= 80 &&
    !META_LINE.test(first) &&
    !/[[\]]/.test(first)
  const title = looksLikeTitle ? first : titleFromFile(name)
  const second = top[1]?.trim()
  const byline =
    looksLikeTitle && second && !META_LINE.test(second) && !/:/.test(second)
      ? cleanByline(second)
      : null
  const key = text.match(/^\s*key\s*:\s*([A-G][#b]?m?)\b/im)?.[1] ?? null
  return {
    id: nextId('f'),
    title,
    from: base(name),
    song: {
      title,
      writer: byline,
      chart: {onsong: {title, byline, key, content: text}},
    },
  }
}

/** A Word file: chords above the words, titled by its file name */
export function fromWord(name: string, text: string): Found {
  const title = titleFromFile(name)
  const lines = text.split('\n')
  // The Doc's own title on top is the song's name, not chart content
  const blanks = () => {
    while (lines.length && !lines[0].trim()) lines.shift()
  }
  blanks()
  if (lines.length && norm(lines[0]) === norm(title)) lines.shift()
  blanks()
  return {
    id: nextId('f'),
    title,
    from: base(name),
    song: {title, chart: {text: lines.join('\n')}},
  }
}

function fromLibrary(lib: Library, f: Findings) {
  f.library = true
  const ids = new Map<string, string>()
  for (const s of lib.songs) {
    const id = `os:${s.id}`
    const writer = cleanByline(s.byline)
    ids.set(s.id, id)
    f.songs.push({
      id,
      title: s.title,
      from: 'OnSong',
      song: {
        title: s.title,
        writer,
        seconds: s.seconds,
        chart: {
          onsong: {
            title: s.title,
            byline: s.byline,
            key: s.key,
            content: s.content,
          },
        },
      },
    })
  }
  const titleOf = new Map(lib.songs.map((s) => [s.id, s.title]))
  for (const set of lib.sets)
    f.sets.push({
      id: `os:${set.id}`,
      songIds: set.items.map((i) => ids.get(i.songId)!),
      setlist: {
        name: set.title,
        gigDate: set.date,
        items: set.items.map((i) => ({
          song: titleOf.get(i.songId)!,
          key: i.key,
        })),
      },
    })
  for (const b of lib.books)
    f.books.push({
      id: `os:${b.id}`,
      name: b.name,
      songIds: b.songIds.map((id) => ids.get(id)!),
    })
}

/** A Bandstand export, or a file built for scripts/import-band.ts */
function fromJson(name: string, text: string, f: Findings) {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return f.skipped.push({name: base(name), why: 'Not readable JSON'})
  }
  const parsed = BandImport.safeParse(raw)
  const looksRight =
    typeof raw === 'object' &&
    raw !== null &&
    ['songs', 'setlists', 'rehearsals'].some((k) => k in raw)
  if (!parsed.success || !looksRight)
    return f.skipped.push({
      name: base(name),
      why: 'Not a Bandstand export',
    })
  const byTitle = new Map<string, string>()
  for (const song of parsed.data.songs) {
    const id = nextId('j')
    byTitle.set(song.title.toLowerCase(), id)
    f.songs.push({id, title: song.title, from: base(name), song})
  }
  for (const sl of parsed.data.setlists ?? [])
    f.sets.push({
      id: nextId('js'),
      setlist: sl,
      songIds: sl.items.flatMap((it) =>
        'song' in it && byTitle.has(it.song.toLowerCase())
          ? [byTitle.get(it.song.toLowerCase())!]
          : [],
      ),
    })
  f.rehearsals = [...(f.rehearsals ?? []), ...(parsed.data.rehearsals ?? [])]
}

async function readOne(
  file: FileIn,
  f: Findings,
  openSqlite: OpenSqlite,
  depth = 0,
): Promise<void> {
  const name = file.name
  const b = base(name)
  if (b.startsWith('.') || name.includes('__MACOSX/')) return
  const lower = b.toLowerCase()
  if (/\.(zip|backup)$/i.test(lower)) {
    if (depth > 1) return
    let entries: Record<string, Uint8Array>
    try {
      entries = unzipSync(file.bytes)
    } catch {
      return void f.skipped.push({name: b, why: 'Couldn’t open this zip'})
    }
    const lib = Object.keys(entries).find((n) => base(n) === 'OnSong.sqlite3')
    if (lib)
      return readOne({name: lib, bytes: entries[lib]}, f, openSqlite, depth + 1)
    for (const [n, bytes] of Object.entries(entries))
      if (!n.endsWith('/'))
        await readOne({name: n, bytes}, f, openSqlite, depth + 1)
    return
  }
  if (/\.(sqlite3?|db)$/i.test(lower)) {
    try {
      fromLibrary(readOnSongLibrary(await openSqlite(file.bytes)), f)
    } catch {
      f.skipped.push({name: b, why: 'Not an OnSong library'})
    }
    return
  }
  if (lower.endsWith('.docx')) {
    try {
      f.songs.push(fromWord(name, docxText(file.bytes)))
    } catch {
      f.skipped.push({name: b, why: 'Couldn’t read this Word file'})
    }
    return
  }
  const text = () => strFromU8(file.bytes).replace(/^﻿/, '')
  if (CHORDPRO.test(lower)) return void f.songs.push(fromChordPro(name, text()))
  if (TEXT.test(lower)) {
    const t = text()
    if (t.trim()) f.songs.push(fromOnSongText(name, t))
    else f.skipped.push({name: b, why: 'Empty'})
    return
  }
  if (lower.endsWith('.csv') || lower.endsWith('.tsv')) {
    const list = readSongList(text())
    if (!list.length)
      return void f.skipped.push({name: b, why: 'No column of song titles'})
    for (const song of list)
      f.songs.push({id: nextId('c'), title: song.title, from: b, song})
    return
  }
  if (lower.endsWith('.json')) return void fromJson(name, text(), f)
  const why = UNREADABLE.find(([re]) => re.test(lower))?.[1]
  f.skipped.push({name: b, why: why ?? 'Not a kind of file Bandstand reads'})
}

export async function readFiles(
  files: FileIn[],
  openSqlite: OpenSqlite,
  into: Findings = empty(),
): Promise<Findings> {
  for (const file of files) await readOne(file, into, openSqlite)
  return into
}
