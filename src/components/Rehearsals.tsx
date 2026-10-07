'use client'

import {useRouter} from 'next/navigation'
import {useMemo, useState} from 'react'
import {
  nextAllFree,
  formatDay,
  scoreDays,
  weekday,
  type Entry,
  type Kind,
  type Member,
} from '@/lib/availability'

type RehearsalRow = {
  id: string
  date: string
  time: string | null
  place: string | null
  note: string | null
  by: string
  mine: boolean
}

const STATES: {kind: Kind | null; label: string; on: string}[] = [
  {kind: null, label: 'Free', on: 'bg-[#1f3a2f] text-[#b6f0d4]'},
  {kind: 'PREFER_NOT', label: 'Prefer not', on: 'bg-[#20304a] text-[#b9d4ff]'},
  {kind: 'PM_OUT', label: 'PM out', on: 'bg-[#3a3220] text-[#f2d18a]'},
  {kind: 'OUT', label: 'Out', on: 'bg-[#4a2a26] text-[#ffb3a6]'},
]

export default function Rehearsals({
  me,
  isAdmin,
  days,
  horizon,
  members,
  entries: initialEntries,
  rehearsals,
}: {
  me: string
  isAdmin: boolean
  days: string[]
  /** Every day ahead that the suggestions may search */
  horizon: string[]
  members: Member[]
  entries: Entry[]
  rehearsals: RehearsalRow[]
}) {
  const router = useRouter()
  const [entries, setEntries] = useState(initialEntries)
  const [answered, setAnswered] = useState(
    () => new Set(members.filter((m) => m.answered).map((m) => m.id)),
  )
  const [failed, setFailed] = useState<string | null>(null)
  const [planning, setPlanning] = useState<string | null>(null)

  const liveMembers = useMemo(
    () => members.map((m) => ({...m, answered: answered.has(m.id)})),
    [members, answered],
  )
  const scores = useMemo(
    () => scoreDays(days, liveMembers, entries),
    [days, liveMembers, entries],
  )
  const ahead = useMemo(
    () => nextAllFree(scoreDays(horizon, liveMembers, entries), 5),
    [horizon, liveMembers, entries],
  )
  const lastMarked = entries.reduce((m, e) => (e.date > m ? e.date : m), '')
  const booked = new Set(rehearsals.map((r) => r.date))
  const mineOn = (date: string) =>
    entries.find((e) => e.userId === me && e.date === date)?.kind ?? null
  const unanswered = liveMembers.filter((m) => !m.answered).map((m) => m.name)

  async function mark(date: string, kind: Kind | null) {
    const before = entries
    setEntries([
      ...entries.filter((e) => !(e.userId === me && e.date === date)),
      ...(kind ? [{userId: me, date, kind}] : []),
    ])
    setAnswered(new Set([...answered, me]))
    const r = await fetch('/api/availability', {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({date, kind}),
    })
    if (!r.ok) {
      setEntries(before)
      setFailed(date)
    } else setFailed(null)
  }

  async function cancel(id: string) {
    const r = await fetch(`/api/rehearsals/${id}`, {method: 'DELETE'})
    if (r.ok) router.refresh()
  }

  // Group my days by week for the list
  const weeks: string[][] = []
  days.forEach((d, i) =>
    i % 7 === 0 ? weeks.push([d]) : weeks[weeks.length - 1].push(d),
  )

  return (
    <main className="mx-auto max-w-5xl px-4 pb-10 pt-5">
      <h1 className="text-3xl font-extrabold">Rehearsals</h1>

      {rehearsals.length > 0 && (
        <section
          aria-labelledby="next-reh"
          className="mt-4 rounded-2xl border border-amber bg-panel p-4"
        >
          <h2
            id="next-reh"
            className="text-xs font-bold uppercase tracking-widest text-amber"
          >
            Coming up
          </h2>
          <ul className="mt-2 space-y-2">
            {rehearsals.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1"
              >
                <strong className="text-lg">{formatDay(r.date)}</strong>
                {r.time && <span>{r.time}</span>}
                {r.place && <span className="text-muted">{r.place}</span>}
                {r.note && (
                  <span className="basis-full text-sm text-muted">
                    {r.note}
                  </span>
                )}
                <span className="text-xs text-faint">set by {r.by}</span>
                {(r.mine || isAdmin) && (
                  <button
                    type="button"
                    onClick={() => cancel(r.id)}
                    className="min-h-9 text-sm text-bad underline"
                  >
                    Cancel
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section
        aria-labelledby="best-h"
        className="mt-4 rounded-2xl bg-panel p-4"
      >
        <h2
          id="best-h"
          className="text-xs font-bold uppercase tracking-widest text-muted"
        >
          Next days everyone can make
        </h2>
        {unanswered.length > 0 && (
          <p className="mt-1 text-sm text-muted">
            Not answered yet: {unanswered.join(', ')} — counted as free until
            they do.
          </p>
        )}
        {!ahead.length && (
          <p className="mt-2 text-sm text-bad">
            No day in the next year has nobody out.
          </p>
        )}
        <ul className="mt-2">
          {ahead.map((d) => (
            <li
              key={d.date}
              className="border-t border-line py-2 first:border-t-0"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="w-28 font-mono font-bold text-amber">
                  {formatDay(d.date)}
                </span>
                <span className="flex-1 text-sm">
                  {d.pmOut.length || d.preferNot.length ? (
                    <>
                      {d.pmOut.length > 0 && (
                        <span className="text-[#f2d18a]">
                          Evening only (afternoon out: {d.pmOut.join(', ')})
                        </span>
                      )}
                      {d.pmOut.length > 0 && d.preferNot.length > 0 && ' · '}
                      {d.preferNot.length > 0 && (
                        <span className="text-[#b9d4ff]">
                          Would rather not: {d.preferNot.join(', ')}
                        </span>
                      )}
                    </>
                  ) : (
                    <strong className="text-good">Everyone free</strong>
                  )}
                </span>
                {booked.has(d.date) ? (
                  <span className="min-h-11 px-3 text-sm font-semibold leading-[44px] text-good">
                    Booked ✓
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      setPlanning(planning === d.date ? null : d.date)
                    }
                    className="min-h-11 rounded-lg border border-line-2 px-3 text-sm font-semibold"
                  >
                    Set rehearsal
                  </button>
                )}
              </div>
              {planning === d.date && (
                <PlanForm
                  date={d.date}
                  onDone={() => (setPlanning(null), router.refresh())}
                />
              )}
            </li>
          ))}
        </ul>
        {lastMarked && ahead.some((d) => d.date > lastMarked) && (
          <p className="mt-2 text-xs text-faint">
            Nobody has marked any days after {formatDay(lastMarked)} yet, so
            later dates are only free as far as we know.
          </p>
        )}
      </section>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <section aria-labelledby="mine-h">
          <div className="flex items-baseline justify-between">
            <h2 id="mine-h" className="text-lg font-bold">
              Your days
            </h2>
            <span className="text-[13px] text-muted">
              {failed ? 'Couldn’t save — try again' : 'Saved as you tap'}
            </span>
          </div>
          <p className="mt-1 text-[13px] text-muted">
            Mark the days you can’t make, or would rather not. Everything else
            counts as free.
          </p>
          {weeks.map((w, wi) => (
            <div key={wi} className="mt-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-faint">
                {wi === 0 ? 'This week' : `Week of ${formatDay(w[0])}`}
              </h3>
              {w.map((d) => {
                const current = mineOn(d)
                return (
                  <div
                    key={d}
                    className="flex items-center gap-2 border-t border-line py-1.5"
                  >
                    <span className="w-20 text-sm font-semibold">
                      {weekday(d)} {Number(d.slice(8))}
                    </span>
                    <div
                      role="radiogroup"
                      aria-label={formatDay(d)}
                      className="grid flex-1 grid-cols-4 overflow-hidden rounded-lg border border-line-2"
                    >
                      {STATES.map((s) => (
                        <button
                          key={s.label}
                          type="button"
                          role="radio"
                          aria-checked={current === s.kind}
                          onClick={() => mark(d, s.kind)}
                          className={`min-h-10 text-[13px] font-semibold ${current === s.kind ? s.on : 'text-faint'}`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </section>

        <section aria-labelledby="all-h" className="min-w-0">
          <h2 id="all-h" className="text-lg font-bold">
            Everyone
          </h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-line">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-ink px-3 py-2 text-left font-semibold">
                    Day
                  </th>
                  {liveMembers.map((m) => (
                    <th
                      key={m.id}
                      className="px-2 py-2 text-center font-semibold"
                    >
                      {m.name}
                      {!m.answered && (
                        <span className="block text-[11px] font-normal text-faint">
                          no answer
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scores.slice(0, 28).map((s) => (
                  <tr key={s.date} className="border-t border-line">
                    <th
                      scope="row"
                      className="sticky left-0 whitespace-nowrap bg-ink px-3 py-1.5 text-left font-medium"
                    >
                      {formatDay(s.date)}
                    </th>
                    {liveMembers.map((m) => {
                      const k = entries.find(
                        (e) => e.userId === m.id && e.date === s.date,
                      )?.kind
                      return (
                        <td key={m.id} className="px-1 py-1 text-center">
                          <span
                            className={`inline-flex h-7 min-w-12 items-center justify-center rounded font-mono text-xs font-bold ${
                              k === 'OUT'
                                ? 'bg-[#4a2a26] text-[#ffb3a6]'
                                : k === 'PM_OUT'
                                  ? 'bg-[#3a3220] text-[#f2d18a]'
                                  : k === 'PREFER_NOT'
                                    ? 'bg-[#20304a] text-[#b9d4ff]'
                                    : m.answered
                                      ? 'bg-[#1f3a2f] text-[#b6f0d4]'
                                      : 'border border-dashed border-line-2 text-faint'
                            }`}
                          >
                            {k === 'OUT'
                              ? 'OUT'
                              : k === 'PM_OUT'
                                ? 'PM'
                                : k === 'PREFER_NOT'
                                  ? 'PREF'
                                  : m.answered
                                    ? ''
                                    : '?'}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[13px] text-faint">
            Blank = free · PREF = would rather not · PM = out in the afternoon ·
            OUT = out all day · ? = hasn’t answered
          </p>
        </section>
      </div>
    </main>
  )
}

function PlanForm({date, onDone}: {date: string; onDone: () => void}) {
  const [time, setTime] = useState('7pm')
  const [place, setPlace] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const r = await fetch('/api/rehearsals', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({date, time, place, note}),
    })
    setBusy(false)
    if (r.ok) onDone()
  }
  return (
    <form
      onSubmit={submit}
      className="mt-2 grid gap-2 rounded-xl border border-line-2 p-3 sm:grid-cols-[8rem_1fr_auto]"
    >
      <label className="flex flex-col text-xs text-muted">
        Time
        <input
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="min-h-11 rounded-lg border border-line-2 bg-ink px-3 text-base text-text"
        />
      </label>
      <label className="flex flex-col text-xs text-muted">
        Where
        <input
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          className="min-h-11 rounded-lg border border-line-2 bg-ink px-3 text-base text-text"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="min-h-11 self-end rounded-lg bg-amber px-4 font-bold text-ink disabled:opacity-50"
      >
        {busy ? 'Saving…' : `Set for ${formatDay(date)}`}
      </button>
      <label className="flex flex-col text-xs text-muted sm:col-span-3">
        Note (optional)
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="min-h-11 rounded-lg border border-line-2 bg-ink px-3 text-base text-text"
        />
      </label>
    </form>
  )
}
