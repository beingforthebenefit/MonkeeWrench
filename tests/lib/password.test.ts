import {describe, it, expect} from 'vitest'
import {generatePassword, hashPassword, verifyPassword} from '@/lib/password'
import {
  clearFailures,
  isThrottled,
  recordFailure,
  resetThrottleForTests,
} from '@/lib/login-throttle'

describe('passwords', () => {
  it('verifies the right password and rejects others', async () => {
    const h = await hashPassword('k7mq-x2vd-9rta-hp3e')
    expect(h.startsWith('scrypt$')).toBe(true)
    expect(await verifyPassword('k7mq-x2vd-9rta-hp3e', h)).toBe(true)
    expect(await verifyPassword('k7mq-x2vd-9rta-hp3f', h)).toBe(false)
    expect(await verifyPassword('anything', null)).toBe(false)
    expect(await verifyPassword('anything', 'garbage')).toBe(false)
  })

  it('salts: the same password hashes differently', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'))
  })

  it('generates readable, unambiguous passwords', () => {
    const p = generatePassword()
    expect(p).toMatch(/^[a-z2-9]{4}(-[a-z2-9]{4}){3}$/)
    expect(p).not.toMatch(/[01ilo]/)
    expect(generatePassword()).not.toBe(p)
  })
})

describe('login throttle', () => {
  it('blocks an email after repeated failures, and clears on success', () => {
    resetThrottleForTests()
    for (let i = 0; i < 8; i++) recordFailure('a@x', '1.1.1.1', 1000)
    expect(isThrottled('a@x', '2.2.2.2', 1000)).toBe(true)
    expect(isThrottled('b@x', '2.2.2.2', 1000)).toBe(false)
    clearFailures('a@x')
    expect(isThrottled('a@x', '2.2.2.2', 1000)).toBe(false)
  })

  it('forgets failures after the window', () => {
    resetThrottleForTests()
    for (let i = 0; i < 8; i++) recordFailure('a@x', '1.1.1.1', 0)
    expect(isThrottled('a@x', '1.1.1.1', 16 * 60_000)).toBe(false)
  })
})
