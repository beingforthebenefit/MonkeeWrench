'use client'

import {useRouter} from 'next/navigation'
import {AddToCalendar, SubscribeCalendar} from '@/components/CalendarLinks'
import MapLink from '@/components/MapLink'
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
  {kind: null, label: 'Free', on: 'bg-good-bg text-good-fg'},
  {kind: 'PREFER_NOT', label: 'Prefer not', on: 'bg-info-bg text-info-fg'},
  {kind: 'PM_OUT', label: 'PM out', on: 'bg-warn-bg text-warn-fg'},
  {kind: 'OUT', label: 'Out', on: 'bg-bad-bg text-bad-fg'},
]

export default function Rehearsals({
  me,
  isAdmin,
  horizon,
  members,
  entries: initialEntries,
  rehearsals,
}: {
  me: string
  isAdmin: boolean
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
  // Lists start short and grow on demand: the band books far ahead
  const [aheadLimit, setAheadLimit] = useState(5)
  const [weekCount, setWeekCount] = useState(8)
  const [gridDays, setGridDays] = useState(28)
  const [ranging, setRanging] = useState(false)
  const days = horizon.slice(0, weekCount * 7)
  const scores = useMemo(
    () => scoreDays(horizon.slice(0, gridDays), liveMembers, entries),
    [horizon, gridDays, liveMembers, entries],
  )
  const ahead = useMemo(
    () => nextAllFree(scoreDays(horizon, liveMembers, entries), aheadLimit),
    [horizon, liveMembers, entries, aheadLimit],
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
                {r.place && (
                  <MapLink
                    place={r.place}
                    className="text-sky no-underline hover:underline"
                  />
                )}
                {r.note && (
                  <span className="basis-full text-sm text-muted">
                    {r.note}
                  </span>
                )}
                <span className="text-xs text-faint">set by {r.by}</span>
                <AddToCalendar r={r} />
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
          <SubscribeCalendar />
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
            No day in the next two years has nobody out.
          </p>
        )}
        <ul className="mt-2">
          {ahead.map((d, i) => (
            <li
              key={d.date}
              className="border-t border-line py-2 first:border-t-0"
            >
              {d.date.slice(0, 7) !== ahead[i - 1]?.date.slice(0, 7) &&
                i > 0 && (
                  <p className="mb-1 text-xs font-bold uppercase tracking-widest text-faint">
                    {monthName(d.date)}
                  </p>
                )}
              <div className="flex items-center gap-3">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
                  <span className="shrink-0 font-mono font-bold text-amber sm:w-28">
                    {formatDay(d.date)}
                  </span>
                  <span className="min-w-0 text-sm">
                    {d.pmOut.length || d.preferNot.length ? (
                      <>
                        {d.pmOut.length > 0 && (
                          <span className="text-warn-fg">
                            Evening only (afternoon out: {d.pmOut.join(', ')})
                          </span>
                        )}
                        {d.pmOut.length > 0 && d.preferNot.length > 0 && ' · '}
                        {d.preferNot.length > 0 && (
                          <span className="text-info-fg">
                            Would rather not: {d.preferNot.join(', ')}
                          </span>
                        )}
                      </>
                    ) : (
                      <strong className="text-good">Everyone free</strong>
                    )}
                  </span>
                </span>
                {booked.has(d.date) ? (
                  <span className="shrink-0 px-3 text-sm font-semibold leading-[44px] text-good">
                    Booked ✓
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      setPlanning(planning === d.date ? null : d.date)
                    }
                    className="min-h-11 shrink-0 rounded-lg border border-line-2 px-3 text-sm font-semibold"
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
        {ahead.length === aheadLimit && (
          <button
            type="button"
            onClick={() => setAheadLimit(aheadLimit + 5)}
            className="mt-2 min-h-11 w-full rounded-lg border border-line-2 text-sm font-semibold"
          >
            Show 5 more days
          </button>
        )}
        {ahead.length > 0 && ahead.length < aheadLimit && (
          <p className="mt-2 text-xs text-faint">
            That’s every such day in the next two years.
          </p>
        )}
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
            <button
              type="button"
              onClick={() => setRanging(!ranging)}
              aria-expanded={ranging}
              className="min-h-11 rounded-lg px-2 text-sm font-semibold text-sky"
            >
              Mark a stretch…
            </button>
            <span className="text-[13px] text-muted">
              {failed ? 'Couldn’t save — try again' : 'Saved as you tap'}
            </span>
          </div>
          <p className="mt-1 text-[13px] text-muted">
            Mark the days you can’t make, or would rather not. Everything else
            counts as free.
          </p>
          {ranging && (
            <RangeForm
              onApplied={(marked, kind) => {
                const set = new Set(marked)
                setEntries([
                  ...entries.filter(
                    (e) => !(e.userId === me && set.has(e.date)),
                  ),
                  ...(kind
                    ? marked.map((date) => ({userId: me, date, kind}))
                    : []),
                ])
                setAnswered(new Set([...answered, me]))
                setRanging(false)
              }}
            />
          )}
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
          {weekCount * 7 < horizon.length && (
            <button
              type="button"
              onClick={() => setWeekCount(weekCount + 4)}
              className="mt-3 min-h-11 w-full rounded-lg border border-line-2 text-sm font-semibold"
            >
              Show 4 more weeks
            </button>
          )}
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
                                ? 'bg-bad-bg text-bad-fg'
                                : k === 'PM_OUT'
                                  ? 'bg-warn-bg text-warn-fg'
                                  : k === 'PREFER_NOT'
                                    ? 'bg-info-bg text-info-fg'
                                    : m.answered
                                      ? 'bg-good-bg text-good-fg'
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
          {gridDays < horizon.length && (
            <button
              type="button"
              onClick={() => setGridDays(gridDays + 28)}
              className="mt-2 min-h-11 w-full rounded-lg border border-line-2 text-sm font-semibold"
            >
              Show 4 more weeks
            </button>
          )}
          <p className="mt-2 text-[13px] text-faint">
            Blank = free · PREF = would rather not · PM = out in the afternoon ·
            OUT = out all day · ? = hasn’t answered
          </p>
        </section>
      </div>
    </main>
  )
}

const monthFmt = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})
function monthName(key: string) {
  return monthFmt.format(new Date(key + 'T00:00:00Z'))
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Mark a stretch at once: "away Dec 18 – Jan 4", "out every Tuesday through March". */
function RangeForm({
  onApplied,
}: {
  onApplied: (days: string[], kind: Kind | null) => void
}) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [kind, setKind] = useState<Kind | null>('OUT')
  const [weekdays, setWeekdays] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const r = await fetch('/api/availability/range', {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        from,
        to,
        kind,
        ...(weekdays.length ? {weekdays} : {}),
      }),
    })
    setBusy(false)
    if (!r.ok)
      return setError(
        (await r.json().catch(() => ({}))).error ?? 'Couldn’t save that.',
      )
    onApplied((await r.json()).days, kind)
  }
  const toggleDay = (d: number) =>
    setWeekdays(
      weekdays.includes(d) ? weekdays.filter((x) => x !== d) : [...weekdays, d],
    )
  return (
    <form
      onSubmit={submit}
      className="mt-3 flex flex-col gap-3 rounded-xl border border-line-2 bg-panel p-3"
    >
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted">
          From
          <input
            type="date"
            required
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="min-h-11 rounded-lg border border-line-2 bg-ink px-2 text-base text-text"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Through
          <input
            type="date"
            required
            min={from}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="min-h-11 rounded-lg border border-line-2 bg-ink px-2 text-base text-text"
          />
        </label>
      </div>
      <fieldset>
        <legend className="mb-1 text-xs text-muted">Only on (optional)</legend>
        <div className="flex flex-wrap gap-1">
          {WEEKDAYS.map((w, i) => (
            <button
              key={w}
              type="button"
              aria-pressed={weekdays.includes(i)}
              onClick={() => toggleDay(i)}
              className={`min-h-10 rounded-lg px-2.5 text-sm ${weekdays.includes(i) ? 'bg-text font-semibold text-ink' : 'border border-line-2'}`}
            >
              {w}
            </button>
          ))}
        </div>
      </fieldset>
      <div
        role="radiogroup"
        aria-label="Mark as"
        className="grid grid-cols-4 overflow-hidden rounded-lg border border-line-2"
      >
        {STATES.map((st) => (
          <button
            key={st.label}
            type="button"
            role="radio"
            aria-checked={kind === st.kind}
            onClick={() => setKind(st.kind)}
            className={`min-h-10 text-[13px] font-semibold ${kind === st.kind ? st.on : 'text-faint'}`}
          >
            {st.label}
          </button>
        ))}
      </div>
      <button
        type="submit"
        disabled={busy || !from || !to}
        className="min-h-11 rounded-lg bg-accent font-bold text-on-accent disabled:opacity-40"
      >
        {busy ? 'Saving…' : 'Mark these days'}
      </button>
      {error && (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      )}
    </form>
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
        className="min-h-11 self-end rounded-lg bg-accent px-4 font-bold text-on-accent disabled:opacity-50"
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
