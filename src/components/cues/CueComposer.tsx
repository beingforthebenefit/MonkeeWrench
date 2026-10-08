'use client'

import {useCallback, useState} from 'react'
import type {Cue, CueKind} from '@/lib/cues'
import {abcPresets} from '@/lib/abc'
import {fitImage} from '@/lib/resize-image'
import AbcNotation from '@/components/cues/AbcNotation'

const TABS: {kind: CueKind; label: string}[] = [
  {kind: 'TEXT', label: 'Note'},
  {kind: 'IMAGE', label: 'Picture'},
  {kind: 'ABC', label: 'Notation'},
]

/**
 * Add a personal cue (or change one): a note, a picture of a few bars, or
 * notation typed as ABC with a live preview. Saved for you only.
 */
export default function CueComposer({
  songId,
  anchor,
  where,
  songKey,
  steps,
  editing,
  onSaved,
  onCancel,
}: {
  songId: string
  anchor: string
  /** "Chorus 2", "Top of the song" */
  where: string
  /** The chart's original key: notation is written in it */
  songKey: string | null
  /** How far the chart is transposed on screen, for the preview */
  steps: number
  /** An existing cue to change */
  editing?: Cue
  onSaved: (cue: Cue) => void
  onCancel: () => void
}) {
  const [kind, setKind] = useState<CueKind>(editing?.kind ?? 'TEXT')
  const [text, setText] = useState(editing?.text ?? '')
  const [file, setFile] = useState<Blob | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const onAbcError = useCallback((w: string[]) => setWarnings(w), [])

  async function pick(f: File | undefined) {
    if (!f) return
    setError(null)
    try {
      const fitted = await fitImage(f)
      setFile(fitted)
      setPreview(URL.createObjectURL(fitted))
    } catch {
      setError('That picture couldn’t be opened.')
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const r = editing
      ? await fetch(`/api/cues/${editing.id}`, {
          method: 'PATCH',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({text}),
        })
      : await fetch(`/api/songs/${songId}/cues`, {
          method: 'POST',
          body: (() => {
            const f = new FormData()
            f.set('anchor', anchor)
            f.set('kind', kind)
            f.set('text', text)
            if (kind === 'IMAGE' && file) f.set('file', file, 'cue')
            return f
          })(),
        })
    setBusy(false)
    if (!r.ok)
      return setError(
        r.status === 413
          ? 'That picture is too big.'
          : r.status === 415
            ? 'Use a JPEG, PNG or WebP picture.'
            : 'Couldn’t save that.',
      )
    onSaved(await r.json())
  }

  const ready =
    kind === 'IMAGE' ? Boolean(file || editing) : Boolean(text.trim())
  const presets = abcPresets(songKey)

  return (
    <form
      onSubmit={save}
      className="my-2 flex flex-col gap-3 rounded-xl border border-amber bg-panel p-3 text-base"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-muted">
          {editing ? 'Change your cue' : 'Your cue'} ·{' '}
          <strong className="text-text">{where}</strong>
        </p>
        <span className="text-xs text-faint">Only you see this</span>
      </div>

      {!editing && (
        <div
          role="tablist"
          className="grid grid-cols-3 overflow-hidden rounded-lg border border-line-2"
        >
          {TABS.map((t) => (
            <button
              key={t.kind}
              type="button"
              role="tab"
              aria-selected={kind === t.kind}
              onClick={() => setKind(t.kind)}
              className={`min-h-10 text-sm font-semibold ${kind === t.kind ? 'bg-text text-ink' : 'text-muted'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {kind === 'TEXT' && (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          autoFocus
          placeholder="Count in 2 bars, I start alone"
          aria-label="Note"
          className="rounded-lg border border-line-2 bg-ink px-3 py-2 text-base text-text"
        />
      )}

      {kind === 'IMAGE' && (
        <>
          {!editing && (
            <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-dashed border-line-2 px-3 text-sm font-semibold">
              {file ? 'Choose a different picture' : 'Choose a picture…'}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => pick(e.target.files?.[0])}
              />
            </label>
          )}
          {(preview ?? editing?.image?.url) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview ?? editing?.image?.url}
              alt=""
              className="max-h-48 w-auto self-start rounded bg-white"
            />
          )}
          <p className="text-xs text-faint">
            A picture stays as it is when the chart is transposed. For bars that
            should follow the key, use Notation.
          </p>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Caption (optional)"
            aria-label="Caption"
            className="min-h-11 rounded-lg border border-line-2 bg-ink px-3 text-base text-text"
          />
        </>
      )}

      {kind === 'ABC' && (
        <>
          {!text && (
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setText(p.abc)}
                  className="min-h-9 rounded-full border border-line-2 px-3 text-sm"
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            placeholder={`"${songKey ?? 'C'}"B2 B2 B2 B2 | B8 |]`}
            aria-label="Notation (ABC)"
            className="rounded-lg border border-line-2 bg-ink px-3 py-2 font-mono text-sm text-text"
          />
          {text.trim() && (
            <div className="rounded-lg bg-ink px-3 py-2 text-[17px]">
              <AbcNotation
                abc={text}
                songKey={songKey}
                steps={steps}
                onError={onAbcError}
              />
            </div>
          )}
          {warnings.length > 0 && (
            <p className="text-xs text-warn-fg">{warnings[0]}</p>
          )}
          <p className="text-xs text-faint">
            Letters are notes (C–B, then c–b an octave up), numbers are lengths
            (B2 = a quarter, B8 = a whole bar), z is a rest, “G” over a note is
            a chord and | is a bar line. Write it in{' '}
            {songKey ?? 'the song’s key'}: it transposes with the chart.
          </p>
        </>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={!ready || busy}
          className="min-h-11 rounded-lg bg-accent px-5 font-bold text-on-accent disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 px-3 text-muted"
        >
          Cancel
        </button>
        {error && <span className="text-sm text-bad">{error}</span>}
      </div>
    </form>
  )
}
