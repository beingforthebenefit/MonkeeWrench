import type {OwnerStats} from '@/lib/owner-stats'

const usd = (n: number) =>
  n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
const pct = (r: number | null) => (r === null ? '—' : `${Math.round(r * 100)}%`)

function Card({
  label,
  value,
  note,
  children,
}: {
  label: string
  value: string
  note?: string
  children?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-line-2 bg-panel p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-faint">
        {label}
      </p>
      <p className="mt-1 font-mono text-3xl font-bold">{value}</p>
      {note && <p className="mt-1 text-sm text-muted">{note}</p>}
      {children}
    </div>
  )
}

/** The hosted service at a glance. */
export default function OwnerNumbers({stats}: {stats: OwnerStats}) {
  const {by, money, trials, churn} = stats
  const covered = Math.min(1, by.paying / money.toBreakEven)
  const peak = Math.max(1, ...stats.weeks.map((w) => w.count))
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Card
        label="Paying bands"
        value={String(by.paying)}
        note={`${money.toBreakEven} cover the costs`}
      >
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-line"
          role="img"
          aria-label={`${Math.round(covered * 100)}% of the way to covering costs`}
        >
          <div
            className="h-full rounded-full bg-amber"
            style={{width: `${covered * 100}%`}}
          />
        </div>
      </Card>
      <Card
        label="A year, after Polar"
        value={usd(money.yearlyNet)}
        note={`${usd(money.yearlyGross)} before fees · costs ${usd(money.yearlyCosts)}`}
      />
      <Card
        label="Trials"
        value={String(by.trial)}
        note={`${pct(trials.rate)} convert (${trials.converted} of ${trials.decided} decided; ${trials.started} ever)`}
      />
      <Card
        label="Churn"
        value={pct(churn.rate)}
        note={`${churn.ended} of ${churn.subscribed} subscriptions ended`}
      />
      <Card
        label="Bands"
        value={String(stats.bands)}
        note={`${stats.active30} active in the last 30 days`}
      />
      <Card
        label="Cancelled, still paid"
        value={String(by.cancelled)}
        note="Read-only once their year ends"
      />
      <Card
        label="Lapsed"
        value={String(by.lapsed)}
        note={`Read-only · ${by.free} free (never billed)`}
      />
      <Card
        label="Renewals, next 30 days"
        value={String(stats.renewalsNext30)}
      />
      <div className="rounded-xl border border-line-2 bg-panel p-4 sm:col-span-2 lg:col-span-4">
        <p className="text-xs font-bold uppercase tracking-widest text-faint">
          New bands a week, the last 12
        </p>
        <div className="mt-3 flex h-24 items-end gap-1.5">
          {stats.weeks.map((w) => (
            <div
              key={w.start.toISOString()}
              className="flex flex-1 flex-col items-center justify-end gap-1"
              title={`Week of ${w.start.toLocaleDateString()}: ${w.count}`}
            >
              <span className="font-mono text-xs text-muted">
                {w.count || ''}
              </span>
              <div
                className="w-full rounded-t bg-amber"
                style={{
                  height: `${(w.count / peak) * 64 + (w.count ? 4 : 1)}px`,
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
