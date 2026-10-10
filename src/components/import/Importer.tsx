'use client'

import Link from 'next/link'
import {useMemo, useRef, useState} from 'react'
import type {BandImport, SetlistIn, SongIn} from '@/lib/band-import-schema'
import type {ImportSummary} from '@/lib/band-import'
import {
  empty,
  readFiles,
  type Findings,
  type FoundSet,
  type OpenSqlite,
} from '@/lib/import/sources'
import {readSetlistText} from '@/lib/import/setlist-text'

const BATCH = 100
const SHOWN = 150

const btn =
  'min-h-11 rounded-lg border border-line-2 px-4 font-semibold hover:border-text disabled:opacity-50'
const primary =
  'min-h-12 rounded-xl bg-accent px-5 text-[17px] font-extrabold text-on-accent disabled:opacity-50'
const field =
  'min-h-11 w-full rounded-lg border border-line-2 bg-ink px-3 text-base text-text'
const h2 = 'text-xs font-bold uppercase tracking-widest text-muted'

const key = (t: string) => t.trim().toLowerCase()

// SQLite in the browser, fetched only when an OnSong backup is dropped
const openSqlite: OpenSqlite = async (bytes) => {
  const initSqlJs = (await import('sql.js')).default
  const SQL = await initSqlJs({locateFile: () => '/api/import/sqlite'})
  return new SQL.Database(bytes)
}

type Phase =
  | {kind: 'pick'}
  | {kind: 'importing'; done: number; total: number}
  | {kind: 'done'; sum: ImportSummary}

/**
 * Drop files in, choose what comes in, import. The files are read here;
 * the chosen songs go to /api/import a hundred at a time, setlists last.
 */
export default function Importer({existing}: {existing: string[]}) {
  const [found, setFound] = useState<Findings>(empty)
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [chosenSets, setChosenSets] = useState<Set<string>>(new Set())
  const [titles, setTitles] = useState<Record<string, string>>({})
  const [reading, setReading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>({kind: 'pick'})
  const have = useMemo(() => new Set(existing.map(key)), [existing])

  async function add(files: File[]) {
    if (!files.length) return
    setReading(true)
    setError(null)
    try {
      const read = await Promise.all(
        files.map(async (f) => ({
          name: f.name,
          bytes: new Uint8Array(await f.arrayBuffer()),
        })),
      )
      const before = new Set(found.songs.map((s) => s.id))
      const beforeSets = new Set(found.sets.map((s) => s.id))
      const next = await readFiles(read, openSqlite, {
        ...found,
        songs: [...found.songs],
        sets: [...found.sets],
        books: [...found.books],
        skipped: [...found.skipped],
        rehearsals: [...(found.rehearsals ?? [])],
      })
      setFound(next)
      // Files: everything new is chosen. A library is big: nothing until asked
      if (!next.library) {
        setChosen(
          new Set([
            ...chosen,
            ...next.songs
              .filter((s) => !before.has(s.id) && !have.has(key(s.title)))
              .map((s) => s.id),
          ]),
        )
        setChosenSets(
          new Set([
            ...chosenSets,
            ...next.sets.filter((s) => !beforeSets.has(s.id)).map((s) => s.id),
          ]),
        )
      }
    } catch (e) {
      console.error('[import]', e)
      setError('Those files couldn’t be read.')
    }
    setReading(false)
  }

  function chooseSet(set: FoundSet, on: boolean) {
    const s = new Set(chosenSets)
    if (on) s.add(set.id)
    else s.delete(set.id)
    setChosenSets(s)
    // Its songs come with it
    if (on) setChosen(new Set([...chosen, ...set.songIds]))
  }

  const titleOf = (id: string, fallback: string) => titles[id] ?? fallback

  async function run() {
    const songs = found.songs.filter((s) => chosen.has(s.id))
    // A song renamed here is renamed in the setlists too
    const renamed = new Map<string, string>()
    const payload: SongIn[] = songs.map((s) => {
      const title = titleOf(s.id, s.title).trim() || s.title
      renamed.set(key(s.song.title), title)
      return {...s.song, title}
    })
    const setlists = found.sets
      .filter((s) => chosenSets.has(s.id))
      .map((s) => ({
        ...s.setlist,
        items: s.setlist.items.map((it) =>
          'song' in it
            ? {...it, song: renamed.get(key(it.song)) ?? it.song}
            : it,
        ),
      }))
    const batches: BandImport[] = []
    for (let i = 0; i < payload.length; i += BATCH)
      batches.push({songs: payload.slice(i, i + BATCH)})
    if (!batches.length) batches.push({songs: []})
    const last = batches[batches.length - 1]
    last.setlists = setlists
    last.rehearsals = found.rehearsals

    const sum: ImportSummary = {
      songsAdded: 0,
      songsThere: 0,
      cues: 0,
      setlistsAdded: 0,
      setlistsThere: 0,
      rehearsalsAdded: 0,
      missing: [],
    }
    setError(null)
    setPhase({kind: 'importing', done: 0, total: payload.length})
    for (const [n, b] of batches.entries()) {
      const r = await fetch('/api/import', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(b),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) {
        setError(
          `${body.error ?? 'The import stopped.'}${n ? ` The first ${n * BATCH} songs are in; importing again adds the rest without doubling any.` : ''}`,
        )
        setPhase({kind: 'pick'})
        return
      }
      for (const k of Object.keys(sum) as (keyof ImportSummary)[])
        if (k === 'missing') sum.missing.push(...body.missing)
        else sum[k] += body[k]
      setPhase({
        kind: 'importing',
        done: Math.min(payload.length, (n + 1) * BATCH),
        total: payload.length,
      })
    }
    setPhase({kind: 'done', sum})
  }

  if (phase.kind === 'done') return <Done sum={phase.sum} />

  const nSongs = found.songs.filter((s) => chosen.has(s.id)).length
  const nSets = chosenSets.size
  const nothing = !found.songs.length && !found.sets.length
  return (
    <>
      <DropZone onFiles={add} reading={reading} compact={!nothing} />
      {nothing && !reading && <Sources />}

      {found.skipped.length > 0 && (
        <details className="mt-4 rounded-xl border border-line-2 px-4 py-3">
          <summary className="cursor-pointer text-sm text-muted">
            {found.skipped.length} file{found.skipped.length === 1 ? '' : 's'}{' '}
            left out
          </summary>
          <ul className="mt-2 space-y-1 text-sm">
            {found.skipped.map((s, i) => (
              <li key={i}>
                <span className="font-semibold">{s.name}</span>{' '}
                <span className="text-muted">— {s.why}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {found.sets.length > 0 && (
        <SetPicker
          sets={found.sets}
          chosen={chosenSets}
          onChoose={chooseSet}
          library={found.library}
        />
      )}

      {found.books.length > 0 && (
        <section className="mt-8" aria-labelledby="books-h">
          <h2 id="books-h" className={h2}>
            OnSong books
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {found.books.map((b) => (
              <button
                key={b.id}
                type="button"
                className={btn}
                onClick={() => setChosen(new Set([...chosen, ...b.songIds]))}
              >
                Choose {b.name} ({b.songIds.length})
              </button>
            ))}
          </div>
        </section>
      )}

      {found.songs.length > 0 && (
        <SongPicker
          found={found}
          chosen={chosen}
          setChosen={setChosen}
          have={have}
          titles={titles}
          setTitle={(id, t) => setTitles({...titles, [id]: t})}
        />
      )}

      {(found.songs.length > 0 || existing.length > 0) && (
        <PasteSetlist
          titles={[
            ...existing,
            ...found.songs
              .filter((s) => chosen.has(s.id))
              .map((s) => titleOf(s.id, s.title)),
          ]}
          onAdd={(set, extra) => {
            const ids: string[] = []
            const songs = [...found.songs]
            for (const title of extra) {
              const id = `p:${title}:${songs.length}`
              songs.push({
                id,
                title,
                from: 'Pasted setlist',
                song: {title, chart: null},
              })
              ids.push(id)
            }
            const byTitle = new Map(
              songs.map((s) => [key(titleOf(s.id, s.title)), s.id]),
            )
            const fs: FoundSet = {
              id: `p:${found.sets.length}:${set.name}`,
              setlist: set,
              songIds: set.items.flatMap((it) =>
                'song' in it && byTitle.has(key(it.song))
                  ? [byTitle.get(key(it.song))!]
                  : [],
              ),
            }
            setFound({...found, songs, sets: [fs, ...found.sets]})
            setChosenSets(new Set([...chosenSets, fs.id]))
            setChosen(new Set([...chosen, ...ids]))
          }}
        />
      )}

      {error && (
        <p role="alert" className="mt-6 text-bad">
          {error}
        </p>
      )}

      {!nothing && (
        <div className="sticky bottom-0 z-10 mt-8 -mx-4 border-t border-line bg-ink/95 px-4 py-3 backdrop-blur">
          {phase.kind === 'importing' ? (
            <p role="status" className="font-semibold">
              Importing… {phase.done} of {phase.total} songs
            </p>
          ) : (
            <button
              type="button"
              className={primary}
              disabled={!nSongs && !nSets}
              onClick={run}
            >
              Import {nSongs} song{nSongs === 1 ? '' : 's'}
              {nSets ? ` and ${nSets} setlist${nSets === 1 ? '' : 's'}` : ''}
            </button>
          )}
        </div>
      )}
    </>
  )
}

function DropZone({
  onFiles,
  reading,
  compact,
}: {
  onFiles: (f: File[]) => void
  reading: boolean
  compact: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        onFiles(Array.from(e.dataTransfer.files))
      }}
      className={`mt-6 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-4 text-center ${compact ? 'py-5' : 'py-12'} ${over ? 'border-amber bg-panel' : 'border-line-2'}`}
    >
      {reading ? (
        <p role="status" className="font-semibold">
          Reading…
        </p>
      ) : (
        <>
          <p className="font-semibold">
            {compact ? 'Add more files' : 'Drop files here'}
          </p>
          <button
            type="button"
            className={btn}
            onClick={() => input.current?.click()}
          >
            Choose files
          </button>
          {!compact && (
            <p className="text-sm text-faint">
              An OnSong backup, a zip from Google Drive, Word, ChordPro, OnSong
              or text files, a CSV, or a Bandstand export
            </p>
          )}
        </>
      )}
      <input
        ref={input}
        type="file"
        multiple
        hidden
        aria-label="Files to import"
        accept=".backup,.zip,.sqlite3,.docx,.cho,.chopro,.chordpro,.crd,.pro,.onsong,.txt,.csv,.tsv,.json"
        onChange={(e) => {
          onFiles(Array.from(e.target.files ?? []))
          e.target.value = ''
        }}
      />
    </div>
  )
}

/** Where each kind of file comes from */
function Sources() {
  const items: [string, React.ReactNode][] = [
    [
      'OnSong',
      <>
        Make a backup in OnSong (its Backup &amp; Restore screen) and get the{' '}
        <code>.backup</code> file onto this device: Files, AirDrop or email.
        Drop it here, then choose the setlists and songs the band plays. Your
        sets come in as setlists, with their keys.
      </>,
    ],
    [
      'Google Docs',
      <>
        In Google Drive, select the charts (or their folder), then right-click →{' '}
        <b>Download</b>. Drive gives you Word files, zipped when there are
        several: drop the zip here. Chords above the words become a chart; each
        file’s name is the song’s title.
      </>,
    ],
    [
      'ChordPro, OnSong and text files',
      <>
        <code>.cho</code>, <code>.pro</code>, <code>.chordpro</code>,{' '}
        <code>.onsong</code> and <code>.txt</code> files, as many as you like,
        or a zip of them.
      </>,
    ],
    [
      'A spreadsheet of songs',
      <>
        In Google Sheets or Excel, download it as CSV. A column called Song or
        Title is all it needs; Artist, Singer, Length, YouTube and Notes come
        too. The songs come in without charts, to add later.
      </>,
    ],
    [
      'Another Bandstand',
      <>
        A band’s export (Admin → Download everything) from another install,
        hosted or your own.
      </>,
    ],
  ]
  return (
    <dl className="mt-6 grid gap-4 sm:grid-cols-2">
      {items.map(([t, d]) => (
        <div key={t} className="rounded-xl bg-panel p-4">
          <dt className="font-bold">{t}</dt>
          <dd className="mt-1 text-sm text-muted">{d}</dd>
        </div>
      ))}
    </dl>
  )
}

function SetPicker({
  sets,
  chosen,
  onChoose,
  library,
}: {
  sets: FoundSet[]
  chosen: Set<string>
  onChoose: (s: FoundSet, on: boolean) => void
  library: boolean
}) {
  const [q, setQ] = useState('')
  const [all, setAll] = useState(false)
  const t = q.trim().toLowerCase()
  const matching = t
    ? sets.filter((s) => s.setlist.name.toLowerCase().includes(t))
    : sets
  const shown = all || t ? matching : matching.slice(0, 8)
  return (
    <section className="mt-8" aria-labelledby="sets-h">
      <h2 id="sets-h" className={h2}>
        Setlists
      </h2>
      {library && (
        <p className="mt-1 text-sm text-muted">
          Newest first. Choosing a set chooses its songs.
        </p>
      )}
      {sets.length > 8 && (
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Find among ${sets.length} sets`}
          aria-label="Find a set"
          className={`${field} mt-3`}
        />
      )}
      <ul className="mt-3 divide-y divide-line rounded-xl border border-line-2">
        {shown.map((s) => {
          const songs = s.setlist.items.filter((i) => 'song' in i).length
          return (
            <li key={s.id}>
              <label className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2">
                <input
                  type="checkbox"
                  checked={chosen.has(s.id)}
                  onChange={(e) => onChoose(s, e.target.checked)}
                  className="h-5 w-5"
                />
                <span className="flex-1">
                  <span className="font-semibold">{s.setlist.name}</span>
                  <span className="block text-sm text-muted">
                    {songs} song{songs === 1 ? '' : 's'}
                    {s.setlist.gigDate ? ` · ${s.setlist.gigDate}` : ''}
                  </span>
                </span>
              </label>
            </li>
          )
        })}
        {!shown.length && (
          <li className="px-3 py-3 text-sm text-muted">No set matches.</li>
        )}
      </ul>
      {!all && !t && matching.length > shown.length && (
        <button
          type="button"
          className="mt-2 min-h-11 text-sky"
          onClick={() => setAll(true)}
        >
          Show all {matching.length} sets
        </button>
      )}
    </section>
  )
}

function SongPicker({
  found,
  chosen,
  setChosen,
  have,
  titles,
  setTitle,
}: {
  found: Findings
  chosen: Set<string>
  setChosen: (s: Set<string>) => void
  have: Set<string>
  titles: Record<string, string>
  setTitle: (id: string, t: string) => void
}) {
  const [q, setQ] = useState('')
  const [onlyChosen, setOnlyChosen] = useState(false)
  const t = q.trim().toLowerCase()
  const matching = found.songs.filter(
    (s) =>
      (!onlyChosen || chosen.has(s.id)) &&
      (!t ||
        (titles[s.id] ?? s.title).toLowerCase().includes(t) ||
        (s.song.writer ?? '').toLowerCase().includes(t)),
  )
  // The first of a title comes in; later ones with the same title don't
  const firstOf = new Map<string, string>()
  for (const s of found.songs)
    if (chosen.has(s.id)) {
      const k = key(titles[s.id] ?? s.title)
      if (!firstOf.has(k)) firstOf.set(k, s.id)
    }
  const n = chosen.size
  return (
    <section className="mt-8" aria-labelledby="songs-h">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="songs-h" className={h2}>
          Songs · {n} of {found.songs.length} chosen
        </h2>
        <span className="flex gap-3 text-sm">
          <button
            type="button"
            className="min-h-11 text-sky"
            onClick={() =>
              setChosen(new Set([...chosen, ...matching.map((s) => s.id)]))
            }
          >
            Choose {t ? 'these' : 'all'}
          </button>
          <button
            type="button"
            className="min-h-11 text-sky"
            onClick={() => {
              const s = new Set(chosen)
              for (const m of matching) s.delete(m.id)
              setChosen(s)
            }}
          >
            Clear {t ? 'these' : 'all'}
          </button>
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find by title or artist"
          aria-label="Find a song"
          className={`${field} min-w-0 flex-1`}
        />
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlyChosen}
            onChange={(e) => setOnlyChosen(e.target.checked)}
            className="h-5 w-5"
          />
          Chosen only
        </label>
      </div>
      <ul className="mt-3 divide-y divide-line rounded-xl border border-line-2">
        {matching.slice(0, SHOWN).map((s) => {
          const title = titles[s.id] ?? s.title
          const on = chosen.has(s.id)
          const here = have.has(key(title))
          const twin = on && firstOf.get(key(title)) !== s.id
          return (
            <li key={s.id} className="flex items-center gap-3 px-3 py-2">
              <input
                type="checkbox"
                checked={on}
                aria-label={`Import ${title}`}
                onChange={(e) => {
                  const next = new Set(chosen)
                  if (e.target.checked) next.add(s.id)
                  else next.delete(s.id)
                  setChosen(next)
                }}
                className="h-5 w-5 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <input
                  value={title}
                  onChange={(e) => setTitle(s.id, e.target.value)}
                  aria-label="Title"
                  className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 font-semibold hover:border-line-2 focus:border-line-2"
                />
                <p className="px-1 text-xs text-faint">
                  {[s.song.writer, s.from, s.song.chart ? null : 'no chart']
                    .filter(Boolean)
                    .join(' · ')}
                  {on && here && (
                    <span className="text-warn-fg">
                      {' '}
                      · already in the band: left as it is
                    </span>
                  )}
                  {twin && !here && (
                    <span className="text-warn-fg">
                      {' '}
                      · same title as another chosen song: only the first comes
                      in
                    </span>
                  )}
                </p>
              </div>
            </li>
          )
        })}
        {!matching.length && (
          <li className="px-3 py-3 text-sm text-muted">No song matches.</li>
        )}
      </ul>
      {matching.length > SHOWN && (
        <p className="mt-2 text-sm text-muted">
          And {matching.length - SHOWN} more: search to find them.
        </p>
      )}
    </section>
  )
}

function PasteSetlist({
  titles,
  onAdd,
}: {
  titles: string[]
  onAdd: (set: SetlistIn, extra: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [unknown, setUnknown] = useState<string[] | null>(null)
  const [addMissing, setAddMissing] = useState(true)
  if (!open)
    return (
      <p className="mt-8">
        <button type="button" className={btn} onClick={() => setOpen(true)}>
          Paste a setlist
        </button>
      </p>
    )
  const check = () =>
    readSetlistText(name.trim() || 'Pasted setlist', text, titles)
  return (
    <section
      className="mt-8 rounded-xl border border-line-2 p-4"
      aria-labelledby="paste-h"
    >
      <h2 id="paste-h" className={h2}>
        Paste a setlist
      </h2>
      <p className="mt-1 text-sm text-muted">
        One song a line. “Set 1”, “Set 2” or “Encore” start a set; “Break 15” is
        a 15-minute break. A key in brackets, “Proud Mary [D]”, plays it in that
        key.
      </p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Its name, e.g. Riverside Festival"
        aria-label="Setlist name"
        className={`${field} mt-3`}
      />
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setUnknown(null)
        }}
        rows={8}
        aria-label="The setlist"
        placeholder={'Set 1\nProud Mary [D]\nMustang Sally\nBreak 15\nSet 2\n…'}
        className={`${field} mt-2 py-2 font-mono`}
      />
      {unknown && unknown.length > 0 && (
        <div className="mt-2 text-sm">
          <p>
            Not in the band or this import:{' '}
            <span className="font-semibold">{unknown.join(', ')}</span>
          </p>
          <label className="mt-1 flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              checked={addMissing}
              onChange={(e) => setAddMissing(e.target.checked)}
              className="h-5 w-5"
            />
            Add them as songs without charts
          </label>
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className={btn}
          disabled={!text.trim()}
          onClick={() => {
            const first = check()
            if (first.unknown.length && unknown === null)
              return setUnknown(first.unknown)
            const extra = addMissing ? first.unknown : []
            const final = readSetlistText(
              name.trim() || 'Pasted setlist',
              text,
              [...titles, ...extra],
            )
            onAdd(final.setlist, extra)
            setName('')
            setText('')
            setUnknown(null)
            setOpen(false)
          }}
        >
          {unknown?.length ? 'Add the setlist' : 'Check and add'}
        </button>
        <button
          type="button"
          className="min-h-11 px-3 text-muted"
          onClick={() => setOpen(false)}
        >
          Close
        </button>
      </div>
    </section>
  )
}

function Done({sum}: {sum: ImportSummary}) {
  const lines = [
    `${sum.songsAdded} song${sum.songsAdded === 1 ? '' : 's'} added${sum.songsThere ? ` (${sum.songsThere} already in the band, left as they were)` : ''}`,
    sum.setlistsAdded || sum.setlistsThere
      ? `${sum.setlistsAdded} setlist${sum.setlistsAdded === 1 ? '' : 's'} added${sum.setlistsThere ? ` (${sum.setlistsThere} with that name already there)` : ''}`
      : null,
    sum.rehearsalsAdded ? `${sum.rehearsalsAdded} rehearsals added` : null,
    sum.cues
      ? `${sum.cues} of your own notes on top of charts became personal cues`
      : null,
  ].filter(Boolean)
  return (
    <div role="status" className="mt-6 rounded-2xl bg-panel p-5">
      <p className="text-xl font-extrabold">Imported</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      {sum.missing.length > 0 && (
        <p className="mt-3 text-sm text-warn-fg">
          Left out of setlists, not in the band: {sum.missing.join(', ')}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/songs"
          className={`${btn} inline-flex items-center no-underline`}
        >
          See the songs
        </Link>
        {sum.setlistsAdded > 0 && (
          <Link
            href="/setlists"
            className={`${btn} inline-flex items-center no-underline`}
          >
            See the setlists
          </Link>
        )}
        <a
          href="/import"
          className="inline-flex min-h-11 items-center px-3 text-sky"
        >
          Import more
        </a>
      </div>
    </div>
  )
}
