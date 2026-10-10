import {vi} from 'vitest'

/**
 * A stand-in for the Prisma client: every model.method is a vi.fn (made on
 * first use, then kept), answering null for find*, [] for findMany, 0 for
 * count, and the data back for create/update/upsert. $transaction runs a
 * callback with the same client, or awaits an array. Tests set answers
 * with db.song.findFirst.mockResolvedValue(...).
 */
export function prismaMock() {
  const models = new Map<string, Record<string, any>>()
  const fallback =
    (method: string) =>
    async (args: any = {}) => {
      if (method === 'findMany' || method === 'groupBy') return []
      if (method === 'count') return 0
      if (/^(create|update|upsert)$/.test(method))
        return {id: `${method}-id`, ...(args.data ?? args.create ?? {})}
      if (/Many$/.test(method)) return {count: 0}
      if (method === 'delete') return {}
      return null
    }
  const model = (name: string) => {
    if (!models.has(name))
      models.set(
        name,
        new Proxy({} as Record<string, any>, {
          get(t, m: string) {
            if (!(m in t)) t[m] = vi.fn(fallback(m))
            return t[m]
          },
        }),
      )
    return models.get(name)!
  }
  const db: any = new Proxy(
    {},
    {
      get(_t, k: string) {
        if (k === '$transaction')
          return (fn: any) =>
            typeof fn === 'function' ? fn(db) : Promise.all(fn)
        if (k === '$executeRaw' || k === '$queryRaw')
          return (db.__raw ??= vi.fn(async () => 1))
        if (k === '__raw') return undefined
        if (k === 'then') return undefined
        return model(k)
      },
      set(_t, k: string, v) {
        if (k === '__raw') models.set('__raw', v)
        return true
      },
    },
  )
  return db
}

/** Guard contexts for vi.mock('@/lib/guard'): null means "not allowed" */
export const ctx = {
  user: {
    id: 'u1',
    name: 'Ana Ruiz',
    displayName: 'Ana',
    email: 'ana@x.com',
    isOwner: false,
    passwordHash: 'x',
  },
  band: {
    id: 'b1',
    name: 'The Hollow Reeds',
    scheduling: true,
    voteThreshold: 2,
    timezone: 'America/Los_Angeles',
  },
  bands: [],
  isAdmin: true,
}

export const json = (url: string, method: string, body?: unknown) =>
  new Request(`http://t${url}`, {
    method,
    headers: {'Content-Type': 'application/json'},
    body: body === undefined ? undefined : JSON.stringify(body),
  })
