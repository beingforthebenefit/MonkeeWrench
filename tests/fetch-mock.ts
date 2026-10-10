import {vi} from 'vitest'

type Reply =
  | {status?: number; body?: unknown}
  | ((
      init: RequestInit | undefined,
      url: string,
    ) => {status?: number; body?: unknown})

/**
 * A fetch that answers by "METHOD /path" (or "/path" for any method), and
 * records every call. Unmatched requests get 200 {}.
 */
export function mockFetch(routes: Record<string, Reply> = {}) {
  const calls: {url: string; method: string; body: any}[] = []
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    const method = (init?.method ?? 'GET').toUpperCase()
    let body: any = init?.body
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body)
      } catch {
        /* not JSON */
      }
    }
    calls.push({url, method, body})
    const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0]
    const r = routes[`${method} ${path}`] ?? routes[path]
    const reply = typeof r === 'function' ? r(init, url) : (r ?? {})
    const status = reply.status ?? 200
    return new Response(
      status === 204 ? null : JSON.stringify(reply.body ?? {}),
      {status, headers: {'Content-Type': 'application/json'}},
    )
  })
  globalThis.fetch = fn as any
  return {fn, calls}
}
