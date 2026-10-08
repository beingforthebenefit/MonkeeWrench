'use client'

import {useRouter} from 'next/navigation'
import {useRef, useState} from 'react'
import {squareIcon} from '@/lib/resize-image'

export type BandSettingsValues = {
  scheduling: boolean
  name: string
  appName: string
  timezone: string
  chatUrl: string
  tributeTo: string
}

const FIELDS: {
  key: keyof BandSettingsValues
  label: string
  hint: string
  type?: string
}[] = [
  {
    key: 'name',
    label: 'Band name',
    hint: 'On PDFs, calendar events and the sign-in page.',
  },
  {
    key: 'appName',
    label: 'App name',
    hint: 'The title in the header and under the home-screen icon.',
  },
  {
    key: 'chatUrl',
    label: 'Group chat link',
    hint: 'Discord, WhatsApp… linked from everyone’s menu. Blank for none.',
    type: 'url',
  },
  {
    key: 'tributeTo',
    label: 'Tribute to',
    hint: 'For a tribute band: proposals with no artist are theirs. Blank otherwise.',
  },
  {
    key: 'timezone',
    label: 'Time zone',
    hint: 'Rehearsal times and “today”. E.g. America/New_York, Europe/London.',
  },
]

/** The band's name, branding and links: admins only. */
export default function BandSettings({
  initial,
  iconSrc,
  hasIcon,
}: {
  initial: BandSettingsValues
  iconSrc: string
  hasIcon: boolean
}) {
  const router = useRouter()
  const [v, setV] = useState(initial)
  const [saved, setSaved] = useState(initial)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const dirty = JSON.stringify(v) !== JSON.stringify(saved)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const r = await fetch('/api/band', {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(v),
    })
    setBusy(false)
    if (r.ok) {
      setSaved(v)
      setStatus('Saved.')
      // The header and tab title come from the layout
      router.refresh()
    } else
      setStatus(
        (await r.json().catch(() => ({}))).error ?? 'Couldn’t save that.',
      )
  }

  return (
    <form
      onSubmit={save}
      className="mt-3 flex flex-col gap-4 rounded-xl border border-line-2 bg-panel p-4"
    >
      <IconPicker src={iconSrc} hasIcon={hasIcon} />
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={v.scheduling}
          onChange={(e) => setV({...v, scheduling: e.target.checked})}
          className="mt-0.5 h-5 w-5 shrink-0"
        />
        <span>
          <span className="block font-semibold text-text">Scheduling tool</span>
          <span className="text-muted">
            Everyone’s days off and the “next days everyone can make”
            suggestions. Off if the band schedules somewhere else: Rehearsals
            then just lists the rehearsals, and anyone can add one.
          </span>
        </span>
      </label>
      {FIELDS.map((f) => (
        <label key={f.key} className="flex flex-col gap-1 text-sm text-muted">
          {f.label}
          <input
            type={f.type ?? 'text'}
            value={v[f.key]}
            required={f.key === 'name' || f.key === 'appName'}
            onChange={(e) => setV({...v, [f.key]: e.target.value})}
            className="min-h-11 rounded-lg border border-line-2 bg-ink px-3 text-base text-text"
          />
          <span className="text-xs text-faint">{f.hint}</span>
        </label>
      ))}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!dirty || busy}
          className="min-h-11 rounded-lg bg-accent px-5 font-bold text-on-accent disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
        {status && <span className="text-sm text-muted">{status}</span>}
      </div>
    </form>
  )
}

function IconPicker({src, hasIcon}: {src: string; hasIcon: boolean}) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState(src)
  const [background, setBackground] = useState('#f2b134')
  const [fill, setFill] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function render(f: File, bg: string, full: boolean) {
    const blob = await squareIcon(f, {background: bg, scale: full ? 1 : 0.74})
    setPreview(URL.createObjectURL(blob))
    return blob
  }

  async function upload() {
    if (!file) return
    setBusy(true)
    setError(null)
    const blob = await render(file, background, fill)
    const r = await fetch('/api/band/icon', {method: 'PUT', body: blob})
    setBusy(false)
    if (!r.ok) return setError('Couldn’t save that image.')
    setFile(null)
    router.refresh()
  }

  async function reset() {
    await fetch('/api/band/icon', {method: 'DELETE'})
    setPreview('/icons/default-512.png')
    router.refresh()
  }

  return (
    <fieldset className="flex flex-wrap items-start gap-4">
      <legend className="mb-2 text-sm text-muted">Home-screen icon</legend>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={preview}
        alt="Icon preview"
        width={88}
        height={88}
        className="h-[88px] w-[88px] rounded-[20px] border border-line-2"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2 text-sm">
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (!f) return
            setFile(f)
            await render(f, background, fill)
          }}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="min-h-11 rounded-lg border border-line-2 px-3 font-semibold"
          >
            Choose a logo…
          </button>
          {hasIcon && !file && (
            <button
              type="button"
              onClick={reset}
              className="min-h-11 px-2 text-muted underline"
            >
              Use the default
            </button>
          )}
        </div>
        {file && (
          <>
            <label className="flex items-center gap-2">
              Background
              <input
                type="color"
                value={background}
                onChange={(e) => {
                  setBackground(e.target.value)
                  render(file, e.target.value, fill)
                }}
                className="h-9 w-12 rounded border border-line-2 bg-ink"
              />
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={fill}
                onChange={(e) => {
                  setFill(e.target.checked)
                  render(file, background, e.target.checked)
                }}
                className="h-5 w-5"
              />
              Fill the square (for a photo or a logo that’s already square)
            </label>
            <button
              type="button"
              onClick={upload}
              disabled={busy}
              className="min-h-11 self-start rounded-lg bg-accent px-4 font-bold text-on-accent disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Use this icon'}
            </button>
          </>
        )}
        {error && <p className="text-bad">{error}</p>}
        <p className="text-xs text-faint">
          People who already added the app to their home screen need to remove
          it and add it again to see a new icon.
        </p>
      </div>
    </fieldset>
  )
}
