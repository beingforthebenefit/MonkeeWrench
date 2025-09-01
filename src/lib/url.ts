import validator from 'validator'
import {parse as parseDomain} from 'tldts'

/**
 * Validate that a string is a well-formed HTTP(S) URL.
 * - Trims input
 * - Uses validator + URL parsing
 * - Ensures protocol is http or https
 * - Ensures a hostname is present and either localhost, IP, or ICANN domain
 */
export function isHttpUrl(value: string): boolean {
  const v = (value ?? '').trim()
  if (!v) return false
  // Require explicit authority form: scheme://
  if (!/^https?:\/\//i.test(v)) return false
  try {
    // First pass: general URL shape using validator
    if (
      !validator.isURL(v, {
        protocols: ['http', 'https'],
        require_protocol: true,
        require_valid_protocol: true,
        allow_underscores: false,
        allow_trailing_dot: false,
        allow_protocol_relative_urls: false,
        validate_length: true,
        require_tld: false, // we'll enforce TLD/localhost/IP via tldts
      })
    ) {
      return false
    }

    // Second pass: host must be localhost, IP, or ICANN domain with TLD
    const u = new URL(v)
    const host = u.hostname
    if (!host) return false
    if (host.toLowerCase() === 'localhost') return true
    const info = parseDomain(host)
    if (info.isIp) return true
    if (info.isIcann && info.domain && info.publicSuffix) return true
    return false
  } catch {
    return false
  }
}

/**
 * Gives a reason why a URL failed validation. Useful for fine-grained UX.
 */
export function httpUrlError(value: string): string | null {
  const v = (value ?? '').trim()
  if (!v) return 'Empty URL'
  try {
    if (!/^https?:\/\//i.test(v)) return 'Must start with http(s)://'
    if (
      !validator.isURL(v, {
        protocols: ['http', 'https'],
        require_protocol: true,
        require_valid_protocol: true,
        allow_underscores: false,
        allow_trailing_dot: false,
        allow_protocol_relative_urls: false,
        validate_length: true,
        require_tld: false,
      })
    ) {
      return 'Invalid URL'
    }
    const u = new URL(v)
    if (!u.hostname) return 'Missing host'
    const host = u.hostname
    if (host.toLowerCase() === 'localhost') return null
    const info = parseDomain(host)
    if (info.isIp) return null
    if (!(info.isIcann && info.domain && info.publicSuffix)) {
      if (!host.includes('.'))
        return 'Domain must contain a dot or be localhost'
      return 'Invalid domain/TLD'
    }
    return null
  } catch {
    return 'Invalid URL'
  }
}

// Generate helpful URL suggestions for a partially entered value.
export function suggestHttpUrls(input: string, limit = 5): string[] {
  const raw = (input ?? '').trim()
  if (!raw) return []

  // Separate host-ish part from path-ish part
  const hasScheme = /^https?:\/\//i.test(raw)
  const withoutScheme = hasScheme ? raw.replace(/^https?:\/\//i, '') : raw
  const slash = withoutScheme.indexOf('/')
  const hostPart = slash === -1 ? withoutScheme : withoutScheme.slice(0, slash)
  const pathPart = slash === -1 ? '' : withoutScheme.slice(slash)

  const candidates = new Set<string>()

  // Always suggest adding https:// and http:// when missing
  if (!hasScheme) {
    candidates.add(`https://${withoutScheme}`)
    candidates.add(`http://${withoutScheme}`)
  }

  // Suggest www. variant for bare domains
  if (hostPart && !/^www\./i.test(hostPart)) {
    candidates.add(`https://www.${hostPart}${pathPart}`)
  }

  // If single-label host (not localhost), suggest common TLDs
  const info = parseDomain(hostPart)
  const isSingleLabel = hostPart && !hostPart.includes('.')
  if (isSingleLabel && hostPart.toLowerCase() !== 'localhost' && !info.isIp) {
    for (const tld of ['.com', '.org', '.net']) {
      candidates.add(`https://${hostPart}${tld}${pathPart}`)
    }
  }

  // Filter by our validator and de-dup
  const valid = Array.from(candidates).filter((c) => isHttpUrl(c))
  return valid.slice(0, limit)
}
