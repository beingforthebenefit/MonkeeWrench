'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useEffect, useState} from 'react'
import type {Board, BoardProposal} from '@/lib/proposals'
import {shortDate} from '@/lib/dates'

export default function Proposals({
  board,
  isAdmin,
}: {
  board: Board
  isAdmin: boolean
}) {
  const router = useRouter()
  const [proposing, setProposing] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  // Someone else voting or proposing updates this page live
  useEffect(() => {
    const es = new EventSource('/api/stream')
    es.onmessage = () => router.refresh()
    return () => es.close()
  }, [router])

  async function act(id: string, run: () => Promise<Response>) {
    setBusy(id)
    await run()
    setBusy(null)
    router.refresh()
  }
  const vote = (p: BoardProposal) =>
    act(p.id, () =>
      fetch(`/api/proposals/${p.id}/vote`, {
        method: p.mine ? 'DELETE' : 'POST',
      }),
    )
  const setStatus = (id: string, status: 'APPROVED' | 'ARCHIVED' | 'PENDING') =>
    act(id, () =>
      fetch(`/api/proposals/${id}`, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({status}),
      }),
    )
  const remove = (p: {id: string; title: string}) =>
    window.confirm(`Delete the proposal “${p.title}” and its votes?`) &&
    act(p.id, () => fetch(`/api/proposals/${p.id}`, {method: 'DELETE'}))

  return (
    <main className="mx-auto max-w-3xl px-4 pb-12 pt-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Proposals</h1>
          <p className="mt-1 text-muted">
            Songs someone wants to add. At {board.threshold} vote
            {board.threshold === 1 ? '' : 's'} a song joins the book to learn.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setProposing(!proposing)}
          aria-expanded={proposing}
          className="min-h-11 shrink-0 rounded-lg bg-amber px-4 font-bold text-ink"
        >
          Propose a song
        </button>
      </div>

      {proposing && (
        <ProposeForm
          onDone={() => {
            setProposing(false)
            router.refresh()
          }}
        />
      )}

      <section aria-labelledby="open-h" className="mt-6">
        <h2
          id="open-h"
          className="text-xs font-bold uppercase tracking-widest text-muted"
        >
          Open · {board.pending.length}
        </h2>
        {!board.pending.length && (
          <p className="py-8 text-center text-muted">
            Nothing open. Got a Monkees-adjacent idea?
          </p>
        )}
        <ul>
          {board.pending.map((p) => (
            <li
              key={p.id}
              className="border-t border-line py-4 first:border-t-0"
            >
              <ProposalRow
                p={p}
                threshold={board.threshold}
                busy={busy === p.id}
                isAdmin={isAdmin}
                onVote={() => vote(p)}
                onApprove={() => setStatus(p.id, 'APPROVED')}
                onArchive={() => setStatus(p.id, 'ARCHIVED')}
                onDelete={() => remove(p)}
                onSaved={() => router.refresh()}
              />
            </li>
          ))}
        </ul>
      </section>

      {board.approved.length > 0 && (
        <section aria-labelledby="in-h" className="mt-8">
          <h2
            id="in-h"
            className="text-xs font-bold uppercase tracking-widest text-muted"
          >
            Recently voted in
          </h2>
          <ul className="mt-2">
            {board.approved.map((a) => (
              <li
                key={a.id}
                className="flex min-h-12 items-center gap-3 border-t border-line"
              >
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-full border-2 border-muted"
                />
                <span className="flex-1">
                  <strong>{a.title}</strong>{' '}
                  <span className="text-muted">· {a.artist}</span>
                </span>
                <span className="text-sm text-faint">
                  {shortDate(a.approvedAt)}
                </span>
                {a.songId && (
                  <Link
                    href={`/songs/${a.songId}`}
                    className="text-sm text-sky no-underline"
                  >
                    Chart ›
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {board.archived.length > 0 && (
        <section className="mt-8">
          <button
            type="button"
            onClick={() => setShowArchived(!showArchived)}
            aria-expanded={showArchived}
            className="min-h-11 text-xs font-bold uppercase tracking-widest text-muted"
          >
            Archived · {board.archived.length} {showArchived ? '▾' : '▸'}
          </button>
          {showArchived && (
            <ul>
              {board.archived.map((a) => (
                <li
                  key={a.id}
                  className="flex min-h-12 items-center gap-3 border-t border-line text-muted"
                >
                  <span className="flex-1">
                    {a.title} · {a.artist}{' '}
                    <span className="text-faint">— {a.proposer}</span>
                  </span>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setStatus(a.id, 'PENDING')}
                      className="min-h-11 px-2 text-sm underline"
                    >
                      Reopen
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  )
}

function ProposalRow({
  p,
  threshold,
  busy,
  isAdmin,
  onVote,
  onApprove,
  onArchive,
  onDelete,
  onSaved,
}: {
  p: BoardProposal
  threshold: number
  busy: boolean
  isAdmin: boolean
  onVote: () => void
  onApprove: () => void
  onArchive: () => void
  onDelete: () => void
  onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const needed = Math.max(threshold - p.voters.length, 0)
  if (editing)
    return <EditForm p={p} onDone={() => (setEditing(false), onSaved())} />
  return (
    <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
      <div className="min-w-0 flex-1 basis-64">
        <p className="text-lg font-bold leading-snug">
          {p.title} <span className="font-normal text-muted">· {p.artist}</span>
        </p>
        <p className="mt-0.5 text-[13px] text-faint">
          {p.proposer} · {shortDate(p.proposedAt)}
          {p.youtubeUrl && (
            <>
              {' · '}
              <a
                href={p.youtubeUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sky no-underline"
              >
                Recording ↗
              </a>
            </>
          )}
          {p.lyricsUrl && (
            <>
              {' · '}
              <a
                href={p.lyricsUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sky no-underline"
              >
                Lyrics ↗
              </a>
            </>
          )}
        </p>
        <div
          className="mt-2 flex items-center gap-2"
          aria-label={`${p.voters.length} of ${threshold} votes`}
        >
          {Array.from(
            {length: Math.max(threshold, p.voters.length)},
            (_, i) => (
              <span
                key={i}
                aria-hidden="true"
                className={`h-2 w-7 rounded-full ${i < p.voters.length ? 'bg-amber' : 'bg-line-2'}`}
              />
            ),
          )}
          <span className="ml-1 text-[13px] text-muted">
            {p.voters.length ? p.voters.join(', ') : 'No votes yet'}
            {needed > 0 && ` · ${needed} more to add it`}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onVote}
          disabled={busy}
          aria-pressed={p.mine}
          className={`min-h-11 rounded-lg px-4 font-bold disabled:opacity-50 ${p.mine ? 'bg-amber text-ink' : 'border border-line-2'}`}
        >
          {p.mine ? 'Voted ✓' : 'Vote'}
        </button>
        {isAdmin && (
          <details className="relative">
            <summary
              className="flex min-h-11 cursor-pointer list-none items-center rounded-lg px-3 text-muted"
              aria-label={`More for ${p.title}`}
            >
              •••
            </summary>
            <div className="absolute right-0 z-10 mt-1 w-48 rounded-xl border border-line-2 bg-panel p-1.5 shadow-xl">
              <MenuButton onClick={onApprove}>Add to the book now</MenuButton>
              <MenuButton onClick={() => setEditing(true)}>Edit</MenuButton>
              <MenuButton onClick={onArchive}>Archive</MenuButton>
              <MenuButton onClick={onDelete} danger>
                Delete
              </MenuButton>
            </div>
          </details>
        )}
      </div>
    </div>
  )
}

function MenuButton({
  onClick,
  children,
  danger,
}: {
  onClick: () => void
  children: React.ReactNode
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block min-h-11 w-full rounded-lg px-3 text-left hover:bg-line ${danger ? 'text-bad' : ''}`}
    >
      {children}
    </button>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-muted">
      {label}
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 rounded-lg border border-line-2 bg-ink px-3 text-base text-text"
      />
    </label>
  )
}

function ProposeForm({onDone}: {onDone: () => void}) {
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [lyricsUrl, setLyricsUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const r = await fetch('/api/proposals', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        title,
        artist: artist || 'The Monkees',
        youtubeUrl,
        lyricsUrl,
      }),
    })
    if (r.ok) return onDone()
    setError(
      r.status === 429
        ? 'That’s a lot of proposals — try again in an hour.'
        : 'Check the links are full web addresses (https://…).',
    )
  }
  return (
    <form
      onSubmit={submit}
      className="mt-4 grid gap-3 rounded-xl border border-line-2 bg-panel p-4 sm:grid-cols-2"
    >
      <Field label="Song" value={title} onChange={setTitle} required />
      <Field
        label="Originally by (blank = The Monkees)"
        value={artist}
        onChange={setArtist}
      />
      <Field
        label="Recording link (optional)"
        value={youtubeUrl}
        onChange={setYoutubeUrl}
        type="url"
      />
      <Field
        label="Lyrics link (optional)"
        value={lyricsUrl}
        onChange={setLyricsUrl}
        type="url"
      />
      <button
        type="submit"
        className="min-h-11 rounded-lg bg-amber font-bold text-ink sm:col-span-2"
      >
        Propose it
      </button>
      {error && (
        <p role="alert" className="text-sm text-bad sm:col-span-2">
          {error}
        </p>
      )}
    </form>
  )
}

function EditForm({p, onDone}: {p: BoardProposal; onDone: () => void}) {
  const [title, setTitle] = useState(p.title)
  const [artist, setArtist] = useState(p.artist)
  const [youtubeUrl, setYoutubeUrl] = useState(p.youtubeUrl ?? '')
  const [error, setError] = useState<string | null>(null)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const r = await fetch(`/api/proposals/${p.id}`, {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({title, artist, youtubeUrl: youtubeUrl || null}),
    })
    if (r.ok) onDone()
    else setError('Couldn’t save — check the link.')
  }
  return (
    <form
      onSubmit={submit}
      className="grid gap-3 rounded-xl border border-line-2 bg-panel p-4 sm:grid-cols-3"
    >
      <Field label="Song" value={title} onChange={setTitle} required />
      <Field
        label="Originally by"
        value={artist}
        onChange={setArtist}
        required
      />
      <Field
        label="Recording link"
        value={youtubeUrl}
        onChange={setYoutubeUrl}
        type="url"
      />
      <div className="flex gap-2 sm:col-span-3">
        <button
          type="submit"
          className="min-h-11 rounded-lg bg-amber px-4 font-bold text-ink"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onDone}
          className="min-h-11 px-3 text-muted"
        >
          Cancel
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-bad sm:col-span-3">
          {error}
        </p>
      )}
    </form>
  )
}
