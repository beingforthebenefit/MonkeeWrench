'use client'

import Link from 'next/link'
import {useState} from 'react'

type PickBand = {
  id: string
  name: string
  appName: string
  iconAt: number | null
}

export default function BandPicker({
  bands,
  next,
  isOwner,
}: {
  bands: PickBand[]
  next: string
  isOwner: boolean
}) {
  const [busy, setBusy] = useState<string | null>(null)
  async function pick(id: string) {
    setBusy(id)
    const r = await fetch('/api/bands/current', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({bandId: id}),
    })
    if (r.ok) window.location.assign(next)
    else setBusy(null)
  }
  return (
    <main className="mx-auto max-w-md px-4 pb-12 pt-8">
      <h1 className="text-3xl font-extrabold">Which band?</h1>
      {bands.length ? (
        <p className="mt-1 text-muted">
          You can switch any time from the menu under your picture.
        </p>
      ) : (
        <p className="mt-2 text-muted">
          You’re not in a band here yet. Ask whoever runs your band to add you.
        </p>
      )}
      <ul className="mt-5 flex flex-col gap-3">
        {bands.map((b) => (
          <li key={b.id}>
            <button
              type="button"
              onClick={() => pick(b.id)}
              disabled={busy !== null}
              className="flex min-h-16 w-full items-center gap-4 rounded-2xl border border-line-2 bg-panel px-4 py-3 text-left hover:border-text disabled:opacity-60"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  b.iconAt
                    ? `/brand/${b.id}/icon.png?v=${b.iconAt}`
                    : '/icons/default-192.png'
                }
                alt=""
                width={48}
                height={48}
                className="h-12 w-12 shrink-0 rounded-xl"
              />
              <span className="flex flex-col">
                <strong className="text-lg">{b.name}</strong>
                {b.appName !== b.name && (
                  <span className="text-sm text-muted">{b.appName}</span>
                )}
              </span>
              <span className="ml-auto text-muted">
                {busy === b.id ? '…' : '›'}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {isOwner && (
        <p className="mt-6 text-sm">
          <Link href="/bands/manage" className="text-sky">
            Manage all bands on this site ›
          </Link>
        </p>
      )}
    </main>
  )
}
