'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useMemo, useState} from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {CSS} from '@dnd-kit/utilities'
import {transposeKey} from '@/lib/chordpro'
import {shortDate} from '@/lib/dates'
import PdfDialog from '@/components/PdfDialog'
import AutoTextarea from '@/components/AutoTextarea'

export type PickSong = {
  id: string
  title: string
  ready: boolean
  leadSinger: string | null
  key: string | null
}

type Item = {uid: string; songId: string; note: string; key: string}
type Values = {
  name: string
  gigDate: string
  venue: string
  notes: string
  items: Item[]
}

/** The 12 keys reachable from a song's key, spelled conventionally. */
function keyOptions(original: string | null) {
  if (!original) return []
  return Array.from({length: 12}, (_, i) => transposeKey(original, i))
}

let uidCounter = 0
const newUid = () => `new-${Date.now()}-${uidCounter++}`

export default function SetlistEditor({
  id,
  library,
  initial,
  editedBy,
  editedAt,
}: {
  id: string
  library: PickSong[]
  initial: Values
  editedBy: string
  editedAt: string
}) {
  const router = useRouter()
  const [v, setV] = useState<Values>(initial)
  const [saved, setSaved] = useState<Values>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [q, setQ] = useState('')
  const [pdfOpen, setPdfOpen] = useState(false)

  const byId = useMemo(() => new Map(library.map((s) => [s.id, s])), [library])
  const dirty = JSON.stringify(v) !== JSON.stringify(saved)
  const inSet = new Set(v.items.map((i) => i.songId))

  const sensors = useSensors(
    useSensor(PointerSensor, {activationConstraint: {distance: 6}}),
    useSensor(TouchSensor, {activationConstraint: {delay: 150, tolerance: 6}}),
    useSensor(KeyboardSensor, {coordinateGetter: sortableKeyboardCoordinates}),
  )

  const setItems = (items: Item[]) => setV({...v, items})
  const update = (uid: string, patch: Partial<Item>) =>
    setItems(v.items.map((i) => (i.uid === uid ? {...i, ...patch} : i)))
  const move = (from: number, to: number) =>
    to >= 0 && to < v.items.length && setItems(arrayMove(v.items, from, to))

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return
    const from = v.items.findIndex((i) => i.uid === e.active.id)
    const to = v.items.findIndex((i) => i.uid === e.over!.id)
    move(from, to)
  }

  async function save() {
    setBusy(true)
    setError(null)
    const r = await fetch(`/api/setlists/${id}`, {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        name: v.name,
        gigDate: v.gigDate || null,
        venue: v.venue || null,
        notes: v.notes || null,
        items: v.items.map(({songId, note, key}) => ({
          songId,
          note: note || null,
          key: key || null,
        })),
      }),
    })
    setBusy(false)
    if (!r.ok) return setError('Could not save the setlist.')
    setSaved(v)
    router.refresh()
  }

  const results = library.filter((s) =>
    s.title.toLowerCase().includes(q.trim().toLowerCase()),
  )

  return (
    <main className="mx-auto max-w-3xl px-4 pb-32 pt-4">
      <Link
        href={`/setlists/${id}`}
        className="text-sm text-muted no-underline hover:text-text"
      >
        ‹ Back to the setlist
      </Link>
      <label className="mt-1 block">
        <span className="sr-only">Setlist name</span>
        <AutoTextarea
          singleLine
          value={v.name}
          onChange={(e) =>
            setV({...v, name: e.target.value.replace(/\n/g, ' ')})
          }
          className="block w-full rounded-lg border border-transparent bg-transparent px-1 text-3xl font-extrabold leading-tight hover:border-line-2 focus:border-line-2"
        />
      </label>
      <p className="mt-1 px-1 text-sm text-muted">
        {v.items.length} songs · edited by {editedBy} · {shortDate(editedAt)}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-muted">
          Gig date
          <input
            type="date"
            value={v.gigDate}
            onChange={(e) => setV({...v, gigDate: e.target.value})}
            className="min-h-11 rounded-lg border border-line-2 bg-panel px-3 text-base text-text"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Venue
          <input
            value={v.venue}
            onChange={(e) => setV({...v, venue: e.target.value})}
            className="min-h-11 rounded-lg border border-line-2 bg-panel px-3 text-base text-text"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/perform/${id}`}
          className="inline-flex min-h-11 items-center rounded-lg bg-amber px-4 font-extrabold text-ink no-underline"
        >
          ▶ Perform
        </Link>
        <button
          type="button"
          onClick={() => setPdfOpen(true)}
          className="min-h-11 rounded-lg border border-line-2 px-4"
        >
          PDF of the set
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={v.items.map((i) => i.uid)}
          strategy={verticalListSortingStrategy}
        >
          <ol className="mt-5">
            {v.items.map((item, n) => (
              <Row
                key={item.uid}
                item={item}
                n={n}
                count={v.items.length}
                song={byId.get(item.songId)}
                onChange={(p) => update(item.uid, p)}
                onMove={(d) => move(n, n + d)}
                onRemove={() =>
                  setItems(v.items.filter((i) => i.uid !== item.uid))
                }
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      {!v.items.length && <p className="py-6 text-muted">No songs yet.</p>}

      <div className="mt-4">
        {picking ? (
          <div className="rounded-xl border border-line-2 bg-panel p-3">
            <div className="flex gap-2">
              <label className="sr-only" htmlFor="pick-q">
                Find a song
              </label>
              <input
                id="pick-q"
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Find a song"
                className="min-h-11 flex-1 rounded-lg border border-line-2 bg-ink px-3"
              />
              <button
                type="button"
                onClick={() => setPicking(false)}
                className="min-h-11 px-3 text-muted"
              >
                Done
              </button>
            </div>
            <ul className="mt-2 max-h-80 overflow-y-auto">
              {results.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setItems([
                        ...v.items,
                        {uid: newUid(), songId: s.id, note: '', key: ''},
                      ])
                    }
                    className="flex min-h-12 w-full items-center gap-3 border-t border-line px-1 text-left"
                  >
                    <span
                      aria-hidden="true"
                      className={`h-2.5 w-2.5 rounded-full ${s.ready ? 'bg-good' : 'border-2 border-muted'}`}
                    />
                    <span className="flex-1">{s.title}</span>
                    {inSet.has(s.id) && (
                      <span className="text-xs text-muted">in set</span>
                    )}
                    <span className="font-mono font-bold text-amber">+</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="min-h-12 w-full rounded-xl border border-dashed border-line-2 font-semibold"
          >
            + Add songs
          </button>
        )}
      </div>

      <label className="mt-6 flex flex-col gap-1 text-sm text-muted">
        Notes for the whole set
        <textarea
          value={v.notes}
          onChange={(e) => setV({...v, notes: e.target.value})}
          rows={3}
          className="rounded-lg border border-line-2 bg-panel px-3 py-2 text-base text-text"
        />
      </label>

      {(dirty || error) && (
        <div className="fixed inset-x-0 bottom-20 z-20 mx-auto flex max-w-3xl items-center gap-3 px-4 md:bottom-4">
          <div className="flex flex-1 items-center gap-3 rounded-xl border border-line-2 bg-panel p-3 shadow-xl">
            <span className="flex-1 text-sm text-muted">
              {error ?? 'Unsaved changes'}
            </span>
            <button
              type="button"
              onClick={() => setV(saved)}
              className="min-h-11 px-3 text-muted"
            >
              Undo
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="min-h-11 rounded-lg bg-amber px-5 font-bold text-ink disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {pdfOpen && (
        <PdfDialog
          title={`${v.name} — ${v.items.length} charts in set order, each in its set key`}
          baseUrl={`/api/setlists/${id}/pdf`}
          shownKey={null}
          originalKey={null}
          footnote={
            dirty ? 'Save first: the PDF uses the saved setlist.' : undefined
          }
          onClose={() => setPdfOpen(false)}
        />
      )}
    </main>
  )
}

function Row({
  item,
  n,
  count,
  song,
  onChange,
  onMove,
  onRemove,
}: {
  item: Item
  n: number
  count: number
  song: PickSong | undefined
  onChange: (p: Partial<Item>) => void
  onMove: (d: number) => void
  onRemove: () => void
}) {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} =
    useSortable({
      id: item.uid,
    })
  const [noteOpen, setNoteOpen] = useState(Boolean(item.note))
  const keys = keyOptions(song?.key ?? null)
  return (
    <li
      ref={setNodeRef}
      style={{transform: CSS.Transform.toString(transform), transition}}
      className={`border-t border-line py-2 ${isDragging ? 'relative z-10 rounded-lg bg-panel shadow-xl' : ''}`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Drag to reorder ${song?.title ?? 'song'}`}
          className="flex h-11 w-8 shrink-0 cursor-grab touch-none items-center justify-center text-faint"
          {...attributes}
          {...listeners}
        >
          <svg
            width="14"
            height="20"
            viewBox="0 0 14 20"
            fill="currentColor"
            aria-hidden="true"
          >
            {[3, 10, 17].map((y) => (
              <g key={y}>
                <circle cx="4" cy={y} r="1.6" />
                <circle cx="10" cy={y} r="1.6" />
              </g>
            ))}
          </svg>
        </button>
        <span className="w-6 font-mono text-sm text-faint">{n + 1}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold leading-snug">
            {song?.title ?? 'Deleted song'}
          </span>
          {song?.leadSinger && (
            <span className="text-[13px] text-muted">{song.leadSinger}</span>
          )}
        </span>
        {keys.length > 0 && (
          <label className="hidden items-center sm:flex">
            <span className="sr-only">Key for {song?.title}</span>
            <select
              value={item.key || keys[0]}
              onChange={(e) =>
                onChange({
                  key: e.target.value === keys[0] ? '' : e.target.value,
                })
              }
              className={`min-h-11 rounded-lg border border-line-2 bg-panel px-2 font-mono font-bold ${item.key ? 'text-amber' : 'text-muted'}`}
            >
              {keys.map((k, i) => (
                <option key={k} value={k}>
                  {k}
                  {i === 0 ? ' (orig)' : ''}
                </option>
              ))}
            </select>
          </label>
        )}
        <span className="hidden gap-1 sm:flex">
          <button
            type="button"
            aria-label="Move up"
            disabled={n === 0}
            onClick={() => onMove(-1)}
            className="h-11 w-9 disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            aria-label="Move down"
            disabled={n === count - 1}
            onClick={() => onMove(1)}
            className="h-11 w-9 disabled:opacity-30"
          >
            ↓
          </button>
        </span>
        <button
          type="button"
          aria-label={`Remove ${song?.title}`}
          onClick={onRemove}
          className="h-11 w-9 text-xl text-faint"
        >
          ×
        </button>
      </div>
      <div className="flex items-start gap-2 pl-16">
        {keys.length > 0 && (
          <label className="flex shrink-0 items-center sm:hidden">
            <span className="sr-only">Key for {song?.title}</span>
            <select
              value={item.key || keys[0]}
              onChange={(e) =>
                onChange({
                  key: e.target.value === keys[0] ? '' : e.target.value,
                })
              }
              className={`min-h-11 rounded-lg border border-line-2 bg-panel px-2 font-mono font-bold ${item.key ? 'text-amber' : 'text-muted'}`}
            >
              {keys.map((k, i) => (
                <option key={k} value={k}>
                  {k}
                  {i === 0 ? ' (orig)' : ''}
                </option>
              ))}
            </select>
          </label>
        )}
        {noteOpen ? (
          <label className="flex min-w-0 flex-1 items-center gap-2">
            <span className="sr-only">Note for {song?.title}</span>
            <AutoTextarea
              value={item.note}
              onChange={(e) => onChange({note: e.target.value})}
              placeholder="e.g. Micky counts it in · straight into the next song"
              className="min-h-10 w-full rounded-lg border border-line-2 bg-panel px-3 py-2 text-[15px] leading-snug"
            />
          </label>
        ) : (
          <button
            type="button"
            onClick={() => setNoteOpen(true)}
            className="min-h-8 text-sm text-faint hover:text-text"
          >
            + Note
          </button>
        )}
      </div>
    </li>
  )
}
