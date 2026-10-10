'use client'

import {useRouter} from 'next/navigation'
import {useState} from 'react'

export type OwnerBand = {
  id: string
  name: string
  standing: 'free' | 'trial' | 'paid' | 'cancelled' | 'lapsed'
  paidUntil: string | null
  members: number
  songs: number
  lastActivity: string | null
  createdAt: string
}

const BADGE: Record<OwnerBand['standing'], [string, string]> = {
  free: ['Free', 'bg-line-2 text-text'],
  trial: ['Trial', 'bg-info-bg text-info-fg'],
  paid: ['Paying', 'bg-good-bg text-good-fg'],
  cancelled: ['Cancelled', 'bg-warn-bg text-warn-fg'],
  lapsed: ['Lapsed', 'bg-bad-bg text-bad-fg'],
}

// One format on the server and in the browser (their time zones differ)
const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})
const day = (iso: string | null) => (iso ? fmt.format(new Date(iso)) : '—')

/** Every band: standing, size, activity; open one to change or delete it. */
export default function OwnerBands({
  bands,
  hosted,
}: {
  bands: OwnerBand[]
  hosted: boolean
}) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-line-2">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-panel text-left text-xs uppercase tracking-wider text-faint">
          <tr>
            <th className="px-3 py-2">Band</th>
            {hosted && <th className="px-3 py-2">Standing</th>}
            {hosted && <th className="px-3 py-2">Paid until</th>}
            <th className="px-3 py-2 text-right">People</th>
            <th className="px-3 py-2 text-right">Songs</th>
            <th className="px-3 py-2">Last change</th>
            <th className="px-3 py-2">Started</th>
          </tr>
        </thead>
        <tbody>
          {bands.map((b) => (
            <BandRow
              key={b.id}
              band={b}
              hosted={hosted}
              open={open === b.id}
              onToggle={() => setOpen(open === b.id ? null : b.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BandRow({
  band,
  hosted,
  open,
  onToggle,
}: {
  band: OwnerBand
  hosted: boolean
  open: boolean
  onToggle: () => void
}) {
  const [label, cls] = BADGE[band.standing]
  const cols = hosted ? 7 : 5
  return (
    <>
      <tr
        className={`cursor-pointer border-t border-line hover:bg-panel ${open ? 'bg-panel' : ''}`}
        onClick={onToggle}
      >
        <td className="px-3 py-2.5 font-semibold">
          <button
            type="button"
            aria-expanded={open}
            className="text-left"
            onClick={(e) => {
              e.stopPropagation()
              onToggle()
            }}
          >
            {band.name}
          </button>
        </td>
        {hosted && (
          <td className="px-3 py-2.5">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}
            >
              {label}
            </span>
          </td>
        )}
        {hosted && <td className="px-3 py-2.5">{day(band.paidUntil)}</td>}
        <td className="px-3 py-2.5 text-right font-mono">{band.members}</td>
        <td className="px-3 py-2.5 text-right font-mono">{band.songs}</td>
        <td className="px-3 py-2.5 text-muted">{day(band.lastActivity)}</td>
        <td className="px-3 py-2.5 text-muted">{day(band.createdAt)}</td>
      </tr>
      {open && (
        <tr className="bg-panel">
          <td colSpan={cols} className="px-3 pb-4 pt-1">
            <BandEditor band={band} hosted={hosted} />
          </td>
        </tr>
      )}
    </>
  )
}

function BandEditor({band, hosted}: {band: OwnerBand; hosted: boolean}) {
  const router = useRouter()
  const [name, setName] = useState(band.name)
  const [until, setUntil] = useState(band.paidUntil?.slice(0, 10) ?? '')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function call(method: string, body: unknown, done: string) {
    setBusy(true)
    setMsg(null)
    const r = await fetch(`/api/owner/bands/${band.id}`, {
      method,
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body),
    })
    setBusy(false)
    if (!r.ok)
      return setMsg((await r.json().catch(() => ({}))).error ?? 'That failed.')
    setMsg(done)
    router.refresh()
  }

  const field =
    'min-h-10 rounded-lg border border-line-2 bg-ink px-3 text-base text-text'
  const btn =
    'min-h-10 rounded-lg border border-line-2 px-3 font-semibold disabled:opacity-50'
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          call('PATCH', {name}, 'Renamed.')
        }}
      >
        <label className="flex flex-col gap-1 text-xs text-muted">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={field}
          />
        </label>
        <button
          type="submit"
          disabled={busy || !name.trim() || name === band.name}
          className={btn}
        >
          Rename
        </button>
      </form>
      {hosted && (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Paid until (it can make changes until then)
            <input
              type="date"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
              className={field}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !until}
              onClick={() =>
                call('PATCH', {paidUntil: until}, `Paid until ${until}.`)
              }
              className={btn}
            >
              Set date
            </button>
            <button
              type="button"
              disabled={busy || band.standing === 'free'}
              onClick={() =>
                call('PATCH', {paidUntil: null}, 'Free now: never billed.')
              }
              className={btn}
            >
              Make free
            </button>
          </div>
          <p className="text-xs text-faint">
            A Polar subscription isn’t changed here: cancel or refund it in
            Polar.
          </p>
        </div>
      )}
      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Delete: everything in it goes. Type its name to confirm.
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={band.name}
            className={field}
          />
        </label>
        <button
          type="button"
          disabled={busy || confirm !== band.name}
          onClick={() => call('DELETE', {confirm}, 'Deleted.')}
          className="min-h-10 rounded-lg bg-bad px-3 font-bold text-ink disabled:opacity-40"
        >
          Delete {band.name}
        </button>
      </div>
      {msg && (
        <p role="status" className="text-sm md:col-span-3">
          {msg}
        </p>
      )}
    </div>
  )
}
