'use client'

import {useRouter} from 'next/navigation'
import {useState} from 'react'

type Member = {
  id: string
  name: string
  displayName: string
  email: string
  isAdmin: boolean
  hasPassword: boolean
}

const SITE = 'https://members.monkeebusinessband.com'

export default function Members({
  me,
  initial,
}: {
  me: string
  initial: Member[]
}) {
  const router = useRouter()
  const [members, setMembers] = useState(initial)
  // The one moment a password is visible: right after it is generated
  const [shown, setShown] = useState<{id: string; password: string} | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  async function newPassword(m: Member) {
    setError(null)
    const r = await fetch(`/api/members/${m.id}/password`, {method: 'POST'})
    if (!r.ok) return setError('Could not set a password.')
    const {password} = await r.json()
    setShown({id: m.id, password})
    setMembers(
      members.map((x) => (x.id === m.id ? {...x, hasPassword: true} : x)),
    )
  }

  async function toggleAdmin(m: Member) {
    const r = await fetch(`/api/members/${m.id}`, {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({isAdmin: !m.isAdmin}),
    })
    if (!r.ok)
      return setError(
        (await r.json().catch(() => ({}))).error ?? 'Could not change that.',
      )
    setMembers(
      members.map((x) => (x.id === m.id ? {...x, isAdmin: !x.isAdmin} : x)),
    )
  }

  async function rename(m: Member, displayName: string) {
    if (!displayName.trim() || displayName === m.displayName) return
    await fetch(`/api/members/${m.id}`, {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({displayName}),
    })
    setMembers(members.map((x) => (x.id === m.id ? {...x, displayName} : x)))
  }

  async function remove(m: Member) {
    if (
      !window.confirm(
        `Remove ${m.displayName || m.name}? Their chart edits stay, credited to “someone”; their availability and proposals are deleted.`,
      )
    )
      return
    const r = await fetch(`/api/members/${m.id}`, {method: 'DELETE'})
    if (r.ok) setMembers(members.filter((x) => x.id !== m.id))
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-12 pt-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Band members</h1>
        <button
          type="button"
          onClick={() => setAdding(!adding)}
          className="min-h-11 rounded-lg border border-line-2 px-4 font-semibold"
        >
          Add member
        </button>
      </div>
      <p className="mt-1 text-muted">
        Everyone signs in with their email and a password generated here. Nobody
        is told anything until you send them their password.
      </p>

      {adding && (
        <AddMember
          onAdded={() => {
            setAdding(false)
            router.refresh()
          }}
        />
      )}
      {error && (
        <p role="alert" className="mt-3 text-bad">
          {error}
        </p>
      )}

      <ul className="mt-5">
        {members.map((m) => (
          <li key={m.id} className="border-t border-line py-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <label className="flex items-center">
                <span className="sr-only">
                  Name shown in the app for {m.name}
                </span>
                <input
                  defaultValue={m.displayName}
                  onBlur={(e) => rename(m, e.target.value)}
                  className="min-h-10 w-28 rounded-lg border border-transparent bg-transparent px-2 text-lg font-bold hover:border-line-2 focus:border-line-2"
                />
              </label>
              <span className="min-w-0 flex-1 text-sm text-muted">
                {m.name} · {m.email}
                {m.isAdmin && (
                  <span className="ml-2 rounded bg-line px-1.5 py-0.5 text-xs text-text">
                    admin
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => newPassword(m)}
                className={`min-h-11 rounded-lg px-3 text-sm font-semibold ${m.hasPassword ? 'border border-line-2' : 'bg-amber text-ink'}`}
              >
                {m.hasPassword ? 'Reset password' : 'Create password'}
              </button>
              {m.id !== me && (
                <>
                  <button
                    type="button"
                    onClick={() => toggleAdmin(m)}
                    className="min-h-11 px-2 text-sm text-muted underline"
                  >
                    {m.isAdmin ? 'Remove admin' : 'Make admin'}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(m)}
                    className="min-h-11 px-2 text-sm text-bad underline"
                  >
                    Remove
                  </button>
                </>
              )}
            </div>
            {!m.hasPassword && (
              <p className="mt-1 pl-2 text-xs text-faint">
                No password yet: can’t sign in.
              </p>
            )}
            {shown?.id === m.id && (
              <PasswordNotice
                member={m}
                password={shown.password}
                onDone={() => setShown(null)}
              />
            )}
          </li>
        ))}
      </ul>
    </main>
  )
}

function PasswordNotice({
  member,
  password,
  onDone,
}: {
  member: Member
  password: string
  onDone: () => void
}) {
  const [copied, setCopied] = useState<string | null>(null)
  const message = `Hi ${member.displayName || member.name}! Here's your login for the Monkee Business charts and setlists:\n\n${SITE}\nEmail: ${member.email}\nPassword: ${password}\n\nYou can change the password after signing in (menu → Change password).`
  const copy = async (what: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
    } catch {
      setCopied(null)
    }
  }
  return (
    <div className="mt-3 rounded-xl border border-amber bg-panel p-4">
      <p className="text-sm text-muted">
        New password for {member.displayName || member.name}. It won’t be shown
        again — send it now.
      </p>
      <p className="mt-2 select-all font-mono text-2xl font-bold tracking-wide text-amber">
        {password}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => copy('pw', password)}
          className="min-h-11 rounded-lg border border-line-2 px-3 text-sm font-semibold"
        >
          {copied === 'pw' ? 'Copied ✓' : 'Copy password'}
        </button>
        <button
          type="button"
          onClick={() => copy('msg', message)}
          className="min-h-11 rounded-lg bg-amber px-3 text-sm font-bold text-ink"
        >
          {copied === 'msg' ? 'Copied ✓' : 'Copy message to send'}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="min-h-11 px-3 text-sm text-muted"
        >
          Done
        </button>
      </div>
    </div>
  )
}

function AddMember({onAdded}: {onAdded: () => void}) {
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const r = await fetch('/api/members', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({name, displayName, email}),
    })
    if (r.ok) onAdded()
    else setError((await r.json().catch(() => ({}))).error ?? 'Could not add.')
  }
  return (
    <form
      onSubmit={submit}
      className="mt-4 grid gap-3 rounded-xl border border-line-2 bg-panel p-4 sm:grid-cols-3"
    >
      <label className="flex flex-col gap-1 text-sm text-muted">
        Full name
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-h-11 rounded-lg border border-line-2 bg-ink px-3 text-base text-text"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">
        Shown as
        <input
          value={displayName}
          placeholder={name.split(' ')[0]}
          onChange={(e) => setDisplayName(e.target.value)}
          className="min-h-11 rounded-lg border border-line-2 bg-ink px-3 text-base text-text"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">
        Email
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-h-11 rounded-lg border border-line-2 bg-ink px-3 text-base text-text"
        />
      </label>
      <button
        type="submit"
        className="min-h-11 rounded-lg bg-amber font-bold text-ink sm:col-span-3"
      >
        Add
      </button>
      {error && (
        <p role="alert" className="text-sm text-bad sm:col-span-3">
          {error}
        </p>
      )}
    </form>
  )
}
