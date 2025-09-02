import {describe, it, expect} from 'vitest'
import {isHttpUrl, httpUrlError, suggestHttpUrls} from '@/lib/url'

describe('lib/url', () => {
  it('validates http/https URLs', () => {
    expect(isHttpUrl('https://example.com')).toBe(true)
    expect(isHttpUrl('http://localhost:3000')).toBe(true)
    expect(isHttpUrl('https://127.0.0.1:8080')).toBe(true)
    expect(isHttpUrl('ftp://example.com')).toBe(false)
    expect(isHttpUrl('example.com')).toBe(false)
    expect(isHttpUrl('http://invalid')).toBe(false)
  })

  it('explains URL validation errors', () => {
    expect(httpUrlError('')).toBe('Empty URL')
    expect(httpUrlError('example.com')).toBe('Must start with http(s)://')
    expect(httpUrlError('http://localhost')).toBeNull()
    expect(httpUrlError('https://1.1.1.1')).toBeNull()
    // Single-label non-localhost should complain
    expect(httpUrlError('http://invalid')).toMatch(
      /Domain must contain a dot|Invalid/,
    )
  })

  it('suggests helpful URLs', () => {
    const s1 = suggestHttpUrls('example')
    expect(s1.join(' ')).toMatch(/https:\/\/example\.com/)
    const s2 = suggestHttpUrls('localhost:3000')
    expect(s2).toContain('http://localhost:3000')
  })
})
