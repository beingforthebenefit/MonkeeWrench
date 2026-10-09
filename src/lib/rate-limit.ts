/**
 * At most `max` attempts per key in a sliding window, for the public forms
 * (starting a band, forgotten passwords) that send email. In memory, like
 * login-throttle.ts: there is one app instance.
 */
const hits = new Map<string, number[]>()

export function allow(
  key: string,
  max: number,
  windowMs: number,
  now = Date.now(),
) {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  if (recent.length >= max) {
    hits.set(key, recent)
    return false
  }
  recent.push(now)
  hits.set(key, recent)
  return true
}

export function resetRateLimitsForTests() {
  hits.clear()
}

/** The visitor's address, behind Cloudflare/Caddy/Traefik. */
export function clientIp(h: Headers) {
  return (
    h.get('cf-connecting-ip') ??
    h.get('x-forwarded-for')?.split(',')[0].trim() ??
    'unknown'
  )
}
