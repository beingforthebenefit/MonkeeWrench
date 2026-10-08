'use client'

import {useRouter} from 'next/navigation'
import {useSession} from 'next-auth/react'
import {useRef, useState} from 'react'
import Avatar from '@/components/Avatar'
import {squareJpeg} from '@/lib/resize-image'

/**
 * Pick a photo for a member: tap the picture (or the button) to choose one.
 * Full size on the Account page; `compact` is just the tappable picture, for
 * an admin setting someone else's on the Band members list.
 */
export default function AvatarEditor({
  userId,
  name,
  src,
  self = false,
  compact = false,
}: {
  userId: string
  name: string
  src: string | null
  /** Their own photo: the header picture updates too */
  self?: boolean
  compact?: boolean
}) {
  const router = useRouter()
  const {update} = useSession()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Compact has no room for a message line
  const fail = (msg: string) => (compact ? window.alert(msg) : setError(msg))

  async function done(r: Response) {
    setBusy(false)
    if (!r.ok) return fail('Could not save the photo. Try another one.')
    if (self) await update?.()
    router.refresh()
  }

  async function choose(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setError(null)
    let body: Blob
    try {
      body = await squareJpeg(file)
    } catch {
      setBusy(false)
      return fail('That file isn’t a photo this browser can read.')
    }
    await done(
      await fetch(`/api/avatars/${userId}`, {
        method: 'PUT',
        headers: {'Content-Type': 'image/jpeg'},
        body,
      }),
    )
  }

  async function remove() {
    if (!window.confirm('Remove this photo?')) return
    setBusy(true)
    setError(null)
    await done(await fetch(`/api/avatars/${userId}`, {method: 'DELETE'}))
  }

  const picker = (
    <input
      ref={input}
      type="file"
      accept="image/*"
      className="sr-only"
      tabIndex={-1}
      aria-hidden="true"
      onChange={(e) => {
        choose(e.target.files?.[0])
        e.target.value = ''
      }}
    />
  )
  const label = src ? `Change photo for ${name}` : `Add a photo for ${name}`

  if (compact)
    return (
      <span className="relative shrink-0">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          aria-label={label}
          title={label}
          className="block rounded-full disabled:opacity-50"
        >
          <Avatar name={name} src={src} size={40} />
        </button>
        {picker}
      </span>
    )

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        aria-label={label}
        className="rounded-full disabled:opacity-50"
      >
        <Avatar name={name} src={src} size={88} />
      </button>
      <div className="flex flex-col items-start gap-1">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="min-h-11 rounded-lg border border-line-2 px-4 font-semibold disabled:opacity-50"
        >
          {busy ? 'Saving…' : src ? 'Change photo' : 'Add a photo'}
        </button>
        {src && !busy && (
          <button
            type="button"
            onClick={remove}
            className="min-h-9 text-sm text-muted underline"
          >
            Remove
          </button>
        )}
        {error && (
          <p role="alert" className="text-sm text-bad">
            {error}
          </p>
        )}
      </div>
      {picker}
    </div>
  )
}
