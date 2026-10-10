'use client'

import {useRouter} from 'next/navigation'
import {useMemo, useState} from 'react'

export type OwnerPerson = {
  id: string
  name: string
  displayName: string
  email: string
  isOwner: boolean
  hasPassword: boolean
  createdAt: string
  bands: string[]
}

const field =
  'min-h-10 rounded-lg border border-line-2 bg-ink px-3 text-base text-text'
const btn =
  'min-h-10 rounded-lg border border-line-2 px-3 font-semibold disabled:opacity-50'

/** Everyone on the install: find, correct, reset, remove, or add someone to a band. */
export default function OwnerPeople({
  people,
  bands,
  me,
  emails,
}: {
  people: OwnerPerson[]
  bands: {id: string; name: string}[]
  me: string
  emails: boolean
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    return t
      ? people.filter((p) =>
          [p.name, p.displayName, p.email, ...p.bands]
            .join(' ')
            .toLowerCase()
            .includes(t),
        )
      : people
  }, [q, people])
  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find by name, email or band"
          aria-label="Find people"
          className={`${field} min-w-0 flex-1`}
        />
        <AddToBand bands={bands} emails={emails} />
      </div>
      <ul className="mt-3 divide-y divide-line rounded-xl border border-line-2">
        {shown.map((p) => (
          <li key={p.id} className="px-3 py-2.5">
            <button
              type="button"
              aria-expanded={open === p.id}
              onClick={() => setOpen(open === p.id ? null : p.id)}
              className="flex w-full flex-wrap items-baseline gap-x-3 gap-y-0.5 text-left"
            >
              <span className="font-semibold">
                {p.name || p.displayName || p.email}
              </span>
              <span className="text-sm text-muted">{p.email}</span>
              {p.isOwner && (
                <span className="rounded-full bg-line-2 px-2 text-xs">
                  owner
                </span>
              )}
              {!p.hasPassword && (
                <span className="text-xs text-warn-fg">no password yet</span>
              )}
              <span className="basis-full text-xs text-faint">
                {p.bands.join(', ') || 'In no band'}
              </span>
            </button>
            {open === p.id && (
              <PersonEditor person={p} self={p.id === me} emails={emails} />
            )}
          </li>
        ))}
        {!shown.length && (
          <li className="px-3 py-4 text-sm text-muted">Nobody matches.</li>
        )}
      </ul>
    </div>
  )
}

function PersonEditor({
  person,
  self,
  emails,
}: {
  person: OwnerPerson
  self: boolean
  emails: boolean
}) {
  const router = useRouter()
  const [name, setName] = useState(person.name)
  const [displayName, setDisplayName] = useState(person.displayName)
  const [email, setEmail] = useState(person.email)
  const [sure, setSure] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function call(
    path: string,
    method: string,
    body: unknown,
    done: string,
  ) {
    setBusy(true)
    setMsg(null)
    const r = await fetch(path, {
      method,
      headers: {'Content-Type': 'application/json'},
      body: body ? JSON.stringify(body) : undefined,
    })
    setBusy(false)
    if (!r.ok)
      return setMsg((await r.json().catch(() => ({}))).error ?? 'That failed.')
    setMsg(done)
    router.refresh()
  }

  const changed =
    name !== person.name ||
    displayName !== person.displayName ||
    email !== person.email
  return (
    <div className="mt-3 grid gap-4 md:grid-cols-[2fr_1fr]">
      <form
        className="grid gap-2 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault()
          call(
            `/api/owner/users/${person.id}`,
            'PATCH',
            {name, displayName, email},
            'Saved.',
          )
        }}
      >
        <label className="flex flex-col gap-1 text-xs text-muted">
          Full name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Shown as
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={field}
          />
        </label>
        <button
          type="submit"
          disabled={busy || !changed}
          className={`${btn} sm:col-span-3 sm:justify-self-start`}
        >
          Save
        </button>
      </form>
      <div className="flex flex-col gap-2">
        {emails && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                call(
                  `/api/owner/users/${person.id}/reset`,
                  'POST',
                  {kind: 'invite'},
                  `Emailed ${person.email} an invite to ${person.bands[0] ?? 'Bandstand'}.`,
                )
              }
              className={btn}
            >
              Email an invite
            </button>
            {person.hasPassword && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  call(
                    `/api/owner/users/${person.id}/reset`,
                    'POST',
                    {kind: 'reset'},
                    `Emailed ${person.email} a password-reset link.`,
                  )
                }
                className={btn}
              >
                Email a password-reset link
              </button>
            )}
          </>
        )}
        {!self && !person.isOwner && (
          <>
            {sure ? (
              <div className="flex flex-col gap-2 rounded-lg border border-bad/50 p-2">
                <p className="text-xs">
                  Remove {person.name || person.email} from every band. Their
                  chart versions stay; their proposals, votes and cues go.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      call(
                        `/api/owner/users/${person.id}`,
                        'DELETE',
                        null,
                        'Deleted.',
                      )
                    }
                    className="min-h-10 rounded-lg bg-bad px-3 font-bold text-ink"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setSure(false)}
                    className="min-h-10 px-2 text-muted"
                  >
                    Keep
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSure(true)}
                className="min-h-10 text-left text-sm text-bad underline"
              >
                Delete this person…
              </button>
            )}
          </>
        )}
      </div>
      {msg && (
        <p role="status" className="text-sm md:col-span-2">
          {msg}
        </p>
      )}
    </div>
  )
}

function AddToBand({
  bands,
  emails,
}: {
  bands: {id: string; name: string}[]
  emails: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [bandId, setBandId] = useState(bands[0]?.id ?? '')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className={btn}>
        Add someone to a band
      </button>
    )
  return (
    <form
      className="grid basis-full gap-2 rounded-xl border border-line-2 bg-panel p-3 sm:grid-cols-4"
      onSubmit={async (e) => {
        e.preventDefault()
        setMsg(null)
        const r = await fetch('/api/owner/members', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({bandId, name, email, isAdmin}),
        })
        const body = await r.json().catch(() => ({}))
        if (!r.ok) return setMsg(body.error ?? 'That failed.')
        setMsg(
          body.invited
            ? `Added, and emailed ${email} a link to choose a password.`
            : body.existing
              ? 'Added with their existing account.'
              : 'Added. They have no password yet.',
        )
        setName('')
        setEmail('')
        router.refresh()
      }}
    >
      <label className="flex flex-col gap-1 text-xs text-muted">
        Band
        <select
          value={bandId}
          onChange={(e) => setBandId(e.target.value)}
          className={field}
        >
          {bands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Full name
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={field}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Email
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={field}
        />
      </label>
      <label className="flex items-center gap-2 self-end pb-2 text-sm">
        <input
          type="checkbox"
          checked={isAdmin}
          onChange={(e) => setIsAdmin(e.target.checked)}
        />
        Admin of the band
      </label>
      <div className="flex gap-2 sm:col-span-4">
        <button
          type="submit"
          className="min-h-10 rounded-lg bg-accent px-4 font-bold text-on-accent"
        >
          Add{emails ? ' and email them' : ''}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-10 px-3 text-muted"
        >
          Close
        </button>
      </div>
      {msg && (
        <p role="status" className="text-sm sm:col-span-4">
          {msg}
        </p>
      )}
    </form>
  )
}
