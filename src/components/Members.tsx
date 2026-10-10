'use client'

import {useRouter} from 'next/navigation'
import {useEffect, useState} from 'react'
import AvatarEditor from '@/components/AvatarEditor'

type Member = {
  id: string
  name: string
  displayName: string
  email: string
  isAdmin: boolean
  hasPassword: boolean
  avatar: string | null
  /** Can I change their name, email and password? Not if they're also in
   * a band I don't run (that would reach into the other band). */
  managed: boolean
}

export default function Members({
  me,
  initial,
  bandName,
  site,
  invites = false,
}: {
  me: string
  initial: Member[]
  bandName: string
  /** This band's web address, for the sign-in message */
  site: string
  /** Email is set up: adding someone emails them a link */
  invites?: boolean
}) {
  const router = useRouter()
  const [members, setMembers] = useState(initial)
  // After adding someone the page refreshes with them in it: show that
  useEffect(() => setMembers(initial), [initial])
  // The one moment a password is visible: right after it is generated
  const [shown, setShown] = useState<{id: string; password: string} | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  // What adding someone did (joined with their account, or was emailed)
  const [notice, setNotice] = useState<string | null>(null)

  async function newPassword(m: Member) {
    setError(null)
    const r = await fetch(`/api/members/${m.id}/password`, {method: 'POST'})
    if (!r.ok)
      return setError(
        (await r.json().catch(() => ({}))).error ?? 'Could not set a password.',
      )
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
        `Remove ${m.displayName || m.name} from ${bandName}? Their chart edits stay. If they’re not in another band here, their account and proposals are deleted too.`,
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
        {invites
          ? 'Everyone signs in with their email and a password. Adding someone emails them a link to choose theirs; you can also make one here and send it yourself.'
          : 'Everyone signs in with their email and a password generated here. Nobody is told anything until you send them their password.'}
      </p>

      {adding && (
        <AddMember
          onAdded={({existing, invited}) => {
            setAdding(false)
            setNotice(
              existing && !invited
                ? 'They already had an account from another band here, so they’re in with the same email and password.'
                : invited
                  ? '✓ Added, and emailed a link to choose their password. They’re in the list below.'
                  : '✓ Added. Use “Create password” on their row below, and send it to them.',
            )
            router.refresh()
          }}
        />
      )}
      {notice && (
        <p
          role="status"
          className="mt-3 flex items-start gap-3 rounded-lg bg-good-bg px-4 py-3 text-good-fg"
        >
          <span className="flex-1">{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
            className="-my-1 min-h-8 px-1 font-bold"
          >
            ✕
          </button>
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-bad">
          {error}
        </p>
      )}

      <ul className="mt-5">
        {members.map((m) => (
          <li key={m.id} className="border-t border-line py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <AvatarEditor
                  compact
                  userId={m.id}
                  name={m.displayName || m.name}
                  src={m.avatar}
                  self={m.id === me}
                />
                <label className="flex shrink-0 items-center">
                  <span className="sr-only">
                    Name shown in the app for {m.name}
                  </span>
                  <input
                    defaultValue={m.displayName}
                    readOnly={!m.managed}
                    onBlur={(e) => rename(m, e.target.value)}
                    className="min-h-10 w-28 rounded-lg border border-transparent bg-transparent px-2 text-lg font-bold hover:border-line-2 focus:border-line-2"
                  />
                </label>
                <span className="flex min-w-0 flex-1 flex-col text-sm text-muted">
                  <span>
                    {m.name}
                    {m.isAdmin && (
                      <span className="ml-2 rounded bg-line px-1.5 py-0.5 text-xs text-text">
                        admin
                      </span>
                    )}
                  </span>
                  <span className="break-all text-faint">{m.email}</span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 pl-2 sm:pl-0">
                {m.managed ? (
                  <button
                    type="button"
                    onClick={() => newPassword(m)}
                    className={`min-h-11 rounded-lg px-3 text-sm font-semibold ${m.hasPassword ? 'border border-line-2' : 'bg-accent text-on-accent'}`}
                  >
                    {m.hasPassword ? 'Reset password' : 'Create password'}
                  </button>
                ) : (
                  <span className="px-2 text-xs text-faint">
                    Also in another band: their own admins manage their sign-in
                  </span>
                )}
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
            </div>
            {!m.hasPassword && (
              <p className="mt-1 pl-2 text-xs text-faint">
                No password yet: can’t sign in.
              </p>
            )}
            {shown?.id === m.id && (
              <PasswordNotice
                bandName={bandName}
                site={site}
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
  bandName,
  site,
  member,
  password,
  onDone,
}: {
  bandName: string
  site: string
  member: Member
  password: string
  onDone: () => void
}) {
  const [copied, setCopied] = useState<string | null>(null)
  const message = `Hi ${member.displayName || member.name}! Here's your login for the ${bandName} charts and setlists:\n\n${site}\nEmail: ${member.email}\nPassword: ${password}\n\nYou can change the password after signing in (menu → Account & settings).`
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
          className="min-h-11 rounded-lg bg-accent px-3 text-sm font-bold text-on-accent"
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

function AddMember({
  onAdded,
}: {
  onAdded: (r: {existing: boolean; invited: boolean}) => void
}) {
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
    if (r.ok) {
      const body = await r.json().catch(() => ({}))
      onAdded({
        existing: Boolean(body.existing),
        invited: Boolean(body.invited),
      })
    } else
      setError((await r.json().catch(() => ({}))).error ?? 'Could not add.')
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
        className="min-h-11 rounded-lg bg-accent font-bold text-on-accent sm:col-span-3"
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
