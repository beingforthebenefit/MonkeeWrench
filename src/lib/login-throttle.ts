/**
 * Slows down password guessing. In memory: there is one app instance, and a
 * restart clearing the counters is acceptable. Generated passwords are long
 * enough that this is a backstop, not the main defence.
 */
const WINDOW_MS = 15 * 60_000
const MAX_PER_EMAIL = 8
const MAX_PER_IP = 30

const failures = new Map<string, number[]>()

function recent(key: string, now: number) {
  const list = (failures.get(key) ?? []).filter((t) => now - t < WINDOW_MS)
  failures.set(key, list)
  return list
}

export function isThrottled(email: string, ip: string, now = Date.now()) {
  return (
    recent(`e:${email}`, now).length >= MAX_PER_EMAIL ||
    recent(`i:${ip}`, now).length >= MAX_PER_IP
  )
}

export function recordFailure(email: string, ip: string, now = Date.now()) {
  recent(`e:${email}`, now).push(now)
  recent(`i:${ip}`, now).push(now)
}

export function clearFailures(email: string) {
  failures.delete(`e:${email}`)
}

export function resetThrottleForTests() {
  failures.clear()
}
