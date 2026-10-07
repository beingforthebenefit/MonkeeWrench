/**
 * Wrap an API route handler so the guards' thrown Responses (401/403 from
 * requireSession/requireAdmin) are returned as-is. Next.js turns anything a
 * handler throws into a 500, which is wrong and looks like an outage.
 */
export function route<A extends unknown[]>(
  handler: (...args: A) => Promise<Response>,
) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args)
    } catch (e) {
      if (e instanceof Response) return e
      throw e
    }
  }
}
