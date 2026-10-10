/**
 * An OnSong backup's library (OnSong.sqlite3 inside the .backup file):
 * every song with its chart, every set in order, and the books. Read on the
 * device with sql.js; nothing here touches the network.
 */

/** The bit of sql.js's Database this needs (so tests can pass a fake) */
export type SqlDb = {
  exec(sql: string): {columns: string[]; values: unknown[][]}[]
}

export type LibrarySong = {
  id: string
  title: string
  byline: string | null
  key: string | null
  content: string
  seconds: number | null
}
export type LibrarySet = {
  id: string
  title: string
  /** yyyy-mm-dd, when OnSong has a date for it */
  date: string | null
  items: {songId: string; key: string | null}[]
}
export type LibraryBook = {id: string; name: string; songIds: string[]}
export type Library = {
  songs: LibrarySong[]
  sets: LibrarySet[]
  books: LibraryBook[]
}

function rows(db: SqlDb, sql: string) {
  const [res] = db.exec(sql)
  if (!res) return []
  return res.values.map((v) =>
    Object.fromEntries(res.columns.map((c, i) => [c, v[i]])),
  ) as Record<string, unknown>[]
}

const str = (v: unknown) =>
  typeof v === 'string' && v.trim() ? v.trim() : null

function hasTable(db: SqlDb, name: string) {
  return rows(
    db,
    `SELECT name FROM sqlite_master WHERE type='table' AND name='${name}'`,
  ).length
}

/** OnSong keeps Unix seconds; the date as it was where the set was made */
function dateOf(v: unknown) {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n) || n <= 0) return null
  const d = new Date(n * 1000)
  const pad = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function readOnSongLibrary(db: SqlDb): Library {
  if (!hasTable(db, 'Song')) throw new Error('not an OnSong library')
  const songs: LibrarySong[] = rows(
    db,
    `SELECT ID, title, byline, "key", content, duration FROM Song
     WHERE coalesce(deleted, 0) = 0 AND length(trim(coalesce(content, ''))) > 0
     ORDER BY coalesce(sortTitle, title) COLLATE NOCASE`,
  ).map((r) => ({
    id: String(r.ID),
    title: str(r.title) ?? 'Untitled',
    byline: str(r.byline),
    key: str(r.key),
    content: String(r.content),
    seconds:
      typeof r.duration === 'number' && r.duration > 0
        ? Math.round(r.duration)
        : null,
  }))
  const known = new Set(songs.map((s) => s.id))

  const sets: LibrarySet[] = []
  if (hasTable(db, 'SongSet') && hasTable(db, 'SongSetItem')) {
    const items = new Map<string, LibrarySet['items']>()
    for (const r of rows(
      db,
      `SELECT setID, songID, transposedKey FROM SongSetItem ORDER BY setID, orderIndex`,
    )) {
      const songId = String(r.songID)
      if (!known.has(songId)) continue
      const list = items.get(String(r.setID)) ?? []
      list.push({songId, key: str(r.transposedKey)})
      items.set(String(r.setID), list)
    }
    for (const r of rows(
      db,
      `SELECT ID, title, datetime, created FROM SongSet
       ORDER BY coalesce(datetime, created) DESC`,
    )) {
      const list = items.get(String(r.ID))
      if (!list?.length) continue
      const date = dateOf(r.datetime) ?? dateOf(r.created)
      sets.push({
        id: String(r.ID),
        title: str(r.title) ?? `Set from ${date ?? 'OnSong'}`,
        date: dateOf(r.datetime),
        items: list,
      })
    }
  }

  const books: LibraryBook[] = []
  if (hasTable(db, 'OSBook') && hasTable(db, 'OSBookSong')) {
    const members = new Map<string, string[]>()
    for (const r of rows(
      db,
      `SELECT bookID, songID FROM OSBookSong ORDER BY bookID, orderIndex`,
    )) {
      if (!known.has(String(r.songID))) continue
      const list = members.get(String(r.bookID)) ?? []
      list.push(String(r.songID))
      members.set(String(r.bookID), list)
    }
    for (const r of rows(
      db,
      `SELECT ID, name FROM OSBook WHERE coalesce(deleted, 0) = 0 ORDER BY name COLLATE NOCASE`,
    )) {
      const songIds = members.get(String(r.ID))
      if (songIds?.length)
        books.push({id: String(r.ID), name: str(r.name) ?? 'Book', songIds})
    }
  }
  return {songs, sets, books}
}
