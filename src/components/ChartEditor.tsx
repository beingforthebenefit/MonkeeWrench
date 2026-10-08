'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useMemo, useState} from 'react'
import {importChordsOverWords, parseChordPro} from '@/lib/chordpro'
import ChartBody from '@/components/chart/ChartBody'

export type SongFormValues = {
  title: string
  writer: string
  leadSinger: string
  guitars: string
  keys: string
  percussion: string
  youtubeUrl: string
  lyricsUrl: string
  status: 'READY' | 'LEARNING'
  notes: string
}

const FIELDS: [keyof SongFormValues, string, string?][] = [
  ['title', 'Title'],
  ['writer', 'Written by'],
  ['leadSinger', 'Lead singer'],
  ['guitars', 'Guitars', 'number'],
  ['keys', 'Keys'],
  ['percussion', 'Percussion'],
  ['youtubeUrl', 'Recording link', 'url'],
  ['lyricsUrl', 'Lyrics link', 'url'],
]

export function toPayload(v: SongFormValues) {
  return {
    ...v,
    guitars: v.guitars.trim() === '' ? null : Number(v.guitars),
    notes: v.notes.trim() || null,
  }
}

export default function ChartEditor({
  songId,
  initialFields,
  initialSource,
  baseNumber,
}: {
  songId: string
  initialFields: SongFormValues
  initialSource: string
  baseNumber: number
}) {
  const router = useRouter()
  const [fields, setFields] = useState(initialFields)
  const [source, setSource] = useState(initialSource)
  const [note, setNote] = useState('')
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const chart = useMemo(() => parseChordPro(source), [source])
  const chartChanged = source !== initialSource
  const fieldsChanged = JSON.stringify(fields) !== JSON.stringify(initialFields)

  function convertPasted() {
    // Turn a chords-over-lyrics paste (e.g. from a website) into ChordPro
    const {source: converted} = importChordsOverWords(source, fields.title)
    setSource(converted)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      if (fieldsChanged) {
        const r = await fetch(`/api/songs/${songId}`, {
          method: 'PATCH',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(toPayload(fields)),
        })
        if (!r.ok)
          throw new Error(
            'Could not save the song details. Check the links are full URLs.',
          )
      }
      if (chartChanged) {
        const r = await fetch(`/api/songs/${songId}/chart`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({source, note: note || null, baseNumber}),
        })
        if (r.status === 409) {
          const {latest} = await r.json()
          throw new Error(
            `Someone saved version ${latest} while you were editing. Your text is still here: copy it, open the chart again, and re-apply your change.`,
          )
        }
        if (!r.ok) throw new Error('Could not save the chart.')
      }
      router.push(`/songs/${songId}`)
      router.refresh()
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  const looksLikeChordsOverWords =
    !/\[[^\]]+\]/.test(source.replace(/^\s*\[[^\]]+\]\s*$/gm, '')) &&
    /^\s*[A-G][#b]?(m|maj|sus|dim|aug|add|\d)*(\s+[A-G][#b]?\S*)*\s*$/m.test(
      source,
    )

  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-16 pt-4 md:px-7">
      <Link
        href={`/songs/${songId}`}
        className="text-sm text-muted no-underline hover:text-text"
      >
        ‹ Back to chart
      </Link>
      <h1 className="mt-1 text-3xl font-extrabold">
        Edit {initialFields.title}
      </h1>

      <section aria-labelledby="details-h" className="mt-5">
        <h2
          id="details-h"
          className="mb-3 text-xs font-bold uppercase tracking-widest text-muted"
        >
          Song details
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FIELDS.map(([k, label, type]) => (
            <label key={k} className="flex flex-col gap-1 text-sm text-muted">
              {label}
              <input
                type={type ?? 'text'}
                inputMode={type === 'number' ? 'numeric' : undefined}
                value={fields[k]}
                onChange={(e) => setFields({...fields, [k]: e.target.value})}
                className="min-h-11 rounded-lg border border-line-2 bg-panel px-3 text-base text-text"
              />
            </label>
          ))}
          <fieldset className="flex flex-col gap-1 text-sm text-muted">
            <legend className="mb-1">Status</legend>
            <div className="flex overflow-hidden rounded-lg border border-line-2">
              {(
                [
                  ['READY', 'Gig-ready'],
                  ['LEARNING', 'Learning'],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={fields.status === v}
                  onClick={() => setFields({...fields, status: v})}
                  className={`min-h-11 flex-1 ${fields.status === v ? 'bg-text font-semibold text-ink' : 'text-text'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="flex flex-col gap-1 text-sm text-muted sm:col-span-2 lg:col-span-3">
            Notes (shown above the chart)
            <textarea
              value={fields.notes}
              onChange={(e) => setFields({...fields, notes: e.target.value})}
              rows={2}
              className="rounded-lg border border-line-2 bg-panel px-3 py-2 text-base text-text"
            />
          </label>
        </div>
      </section>

      <section aria-labelledby="chart-h" className="mt-8">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2
            id="chart-h"
            className="text-xs font-bold uppercase tracking-widest text-muted"
          >
            Chart
          </h2>
          <div
            role="tablist"
            className="flex overflow-hidden rounded-lg border border-line-2 lg:hidden"
          >
            {(['edit', 'preview'] as const).map((t) => (
              <button
                key={t}
                role="tab"
                type="button"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`min-h-10 px-4 capitalize ${tab === t ? 'bg-text font-semibold text-ink' : ''}`}
              >
                {t}
              </button>
            ))}
          </div>
          <span className="flex-1" />
          {looksLikeChordsOverWords && (
            <button
              type="button"
              onClick={convertPasted}
              className="min-h-10 rounded-lg border border-amber px-3 text-sm font-semibold text-amber"
            >
              Convert chords-over-lyrics
            </button>
          )}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className={tab === 'edit' ? '' : 'hidden lg:block'}>
            <label htmlFor="chart-source" className="sr-only">
              Chart (ChordPro)
            </label>
            <textarea
              id="chart-source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              className="h-[65vh] w-full rounded-lg border border-line-2 bg-panel-2 p-3 font-mono text-[15px] leading-relaxed text-text"
            />
            <details className="mt-2 text-sm text-muted">
              <summary className="cursor-pointer py-1">
                How to write a chart
              </summary>
              <div className="mt-2 space-y-1 font-mono text-[13px]">
                <p>Oh, I could [G]hide &apos;neath the [Am]wings</p>
                <p>
                  {'{start_of_verse: Verse 1}'} … {'{end_of_verse}'}
                </p>
                <p>
                  {'{start_of_chorus: Chorus (x2)}'} … {'{end_of_chorus}'}
                </p>
                <p>
                  {'{start_of_intro: Intro}'} [G] [D7sus4] [G]{' '}
                  {'{end_of_intro}'}
                </p>
                <p>{'{comment: Micky counts it in}'}</p>
                <p className="font-sans">
                  Or paste chords-above-lyrics text from anywhere and press
                  “Convert”.
                </p>
              </div>
            </details>
          </div>
          <div
            className={`rounded-lg border border-line p-4 text-[17px] ${tab === 'preview' ? '' : 'hidden lg:block'}`}
          >
            <ChartBody chart={chart} columns={false} />
          </div>
        </div>
      </section>

      <div className="sticky bottom-[max(env(safe-area-inset-bottom),16px)] z-20 mt-6 flex flex-wrap items-center gap-2 rounded-xl border border-line-2 bg-panel p-2 sm:gap-3 sm:p-3">
        <label className="flex min-w-0 flex-1 basis-64 items-center gap-2 text-sm text-muted">
          <span className="hidden shrink-0 sm:inline">What changed?</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What changed? e.g. added the C under “to a”"
            aria-label="What changed?"
            disabled={!chartChanged}
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-line-2 bg-ink px-3 text-base text-text disabled:opacity-50"
          />
        </label>
        <Link
          href={`/songs/${songId}`}
          className="inline-flex min-h-11 items-center px-3 text-muted"
        >
          Cancel
        </Link>
        <button
          type="button"
          onClick={save}
          disabled={saving || (!chartChanged && !fieldsChanged)}
          className="min-h-11 rounded-lg bg-accent px-5 font-bold text-on-accent disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {error && (
          <p role="alert" className="basis-full text-sm text-bad">
            {error}
          </p>
        )}
      </div>
    </main>
  )
}
