import webpush from 'web-push'
import {prisma} from './db'

/**
 * Push notifications: what changed, sent to the phones of everyone else in
 * the band who wants to hear about it.
 *
 * Every change already lands in the activity log. Each one is queued for
 * the people it concerns; a burst of edits (ten fixes to one chart) waits a
 * moment and goes out as one notification. Nobody hears about their own
 * changes. A device the push service says is gone is forgotten.
 */

export type Category = 'charts' | 'setlists' | 'rehearsals' | 'proposals'

/** Which kind of change an activity is, if it's one people get told about. */
export function categoryOf(action: string): Category | null {
  if (/^(chart|song)\./.test(action)) return 'charts'
  if (/^setlist\./.test(action)) return 'setlists'
  if (/^rehearsal\./.test(action)) return 'rehearsals'
  if (/^proposal\./.test(action)) return 'proposals'
  return null
}

const PREF: Record<
  Category,
  'notifyCharts' | 'notifySetlists' | 'notifyRehearsals' | 'notifyProposals'
> = {
  charts: 'notifyCharts',
  setlists: 'notifySetlists',
  rehearsals: 'notifyRehearsals',
  proposals: 'notifyProposals',
}

export function pushReady() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
}

let configured = false
function configure() {
  if (configured || !pushReady()) return pushReady()
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )
  configured = true
  return true
}

export type PushMessage = {
  title: string
  body: string
  /** Where tapping it goes */
  url: string
  /** Notifications with the same tag replace each other */
  tag?: string
}

/** Send to every device a person has turned notifications on for. */
export async function sendToUser(userId: string, msg: PushMessage) {
  if (!configure()) return 0
  const subs = await prisma.pushSubscription.findMany({where: {userId}})
  let sent = 0
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {endpoint: s.endpoint, keys: {p256dh: s.p256dh, auth: s.auth}},
          JSON.stringify(msg),
          {TTL: 60 * 60 * 24},
        )
        sent++
        await prisma.pushSubscription.update({
          where: {id: s.id},
          data: {lastUsedAt: new Date()},
        })
      } catch (e) {
        const status = (e as {statusCode?: number}).statusCode
        // Gone: uninstalled, notifications turned off, or expired
        if (status === 404 || status === 410)
          await prisma.pushSubscription
            .delete({where: {id: s.id}})
            .catch(() => {})
        else console.error('push failed', status, (e as Error).message)
      }
    }),
  )
  return sent
}

// ---------------------------------------------------------------------------
// The queue: activity ids waiting to be told, per person. In memory -- a
// restart drops a minute of notifications at worst.
// ---------------------------------------------------------------------------

const WAIT_MS = Number(process.env.PUSH_BUNDLE_MS ?? 90_000)
const queues = new Map<
  string,
  {ids: string[]; timer: ReturnType<typeof setTimeout>}
>()

/** Called for every activity once it's logged. */
export function queueActivity(activity: {
  id: string
  bandId: string | null
  userId: string | null
  action: string
}) {
  // Only the running app tells people: an import or repair script run from
  // the command line (NEXT_RUNTIME unset) changes charts in bulk, quietly
  if (!process.env.NEXT_RUNTIME) return
  if (!pushReady() || !activity.bandId || !categoryOf(activity.action)) return
  // Who to tell is worked out when the burst ends, so the changes are
  // committed (or rolled back) by then
  const key = `band:${activity.bandId}`
  const q = queues.get(key)
  if (q) {
    q.ids.push(activity.id)
    return
  }
  queues.set(key, {
    ids: [activity.id],
    timer: setTimeout(() => {
      const done = queues.get(key)
      queues.delete(key)
      if (done) flush(done.ids).catch((e) => console.error('push flush', e))
    }, WAIT_MS),
  })
  queues.get(key)!.timer.unref?.()
}

/** Turn a burst of one band's changes into a notification per person. */
export async function flush(ids: string[]) {
  const acts = await prisma.activity.findMany({
    where: {id: {in: ids}},
    orderBy: {createdAt: 'asc'},
    include: {
      user: {select: {name: true, displayName: true}},
      band: {select: {id: true, name: true}},
    },
  })
  if (!acts.length || !acts[0].band) return
  const band = acts[0].band
  const members = await prisma.membership.findMany({
    where: {bandId: band.id, user: {pushSubscriptions: {some: {}}}},
    select: {
      user: {
        select: {
          id: true,
          notifyCharts: true,
          notifySetlists: true,
          notifyRehearsals: true,
          notifyProposals: true,
        },
      },
    },
  })
  for (const {user} of members) {
    // Not their own changes, and only the kinds they asked for
    const mine = acts.filter(
      (a) => a.userId !== user.id && user[PREF[categoryOf(a.action)!]],
    )
    if (!mine.length) continue
    await sendToUser(user.id, describe(mine, band))
  }
}

type Act = {
  action: string
  targetType: string
  targetId: string | null
  summary: string
  user: {name: string | null; displayName: string | null} | null
}

const who = (a: Act) =>
  a.user?.displayName || a.user?.name?.split(' ')[0] || 'Someone'

/** Where a change is looked at, through the band switch so it opens there. */
export function linkFor(
  a: Pick<Act, 'targetType' | 'targetId'>,
  bandId: string,
) {
  const page =
    a.targetType === 'song' && a.targetId
      ? `/songs/${a.targetId}`
      : a.targetType === 'setlist' && a.targetId
        ? `/setlists/${a.targetId}`
        : a.targetType === 'rehearsal'
          ? '/rehearsals'
          : a.targetType === 'proposal'
            ? '/proposals'
            : '/activity'
  return `/bands/switch?to=${bandId}&next=${encodeURIComponent(page)}`
}

/** One change: "Alan: changed the chart for Sway". Several: a summary. */
export function describe(
  acts: Act[],
  band: {id: string; name: string},
): PushMessage {
  if (acts.length === 1) {
    const a = acts[0]
    return {
      title: band.name,
      body: `${who(a)} ${a.summary}`,
      url: linkFor(a, band.id),
      tag: `${band.id}:${a.targetType}:${a.targetId ?? ''}`,
    }
  }
  const people = [...new Set(acts.map(who))]
  const sameThing = acts.every(
    (a) =>
      a.targetType === acts[0].targetType && a.targetId === acts[0].targetId,
  )
  const names =
    people.length <= 2
      ? people.join(' and ')
      : `${people[0]} and ${people.length - 1} others`
  const lines = [...new Set(acts.map((a) => a.summary))].slice(0, 3)
  const more = new Set(acts.map((a) => a.summary)).size - lines.length
  return {
    title: band.name,
    body: `${names}: ${lines.join('; ')}${more > 0 ? ` and ${more} more` : ''}`,
    url: sameThing
      ? linkFor(acts[0], band.id)
      : linkFor({targetType: 'activity', targetId: null}, band.id),
    tag: `${band.id}:changes`,
  }
}
