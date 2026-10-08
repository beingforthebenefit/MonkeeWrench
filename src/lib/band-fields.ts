import {z} from 'zod'
import {isHttpUrl} from './url'

export function isTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat('en-US', {timeZone: tz})
    return true
  } catch {
    return false
  }
}

/** What a band's admins can change about it. */
export const BandFields = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  appName: z.string().trim().min(1).max(40).optional(),
  timezone: z
    .string()
    .trim()
    .refine(isTimeZone, 'Unknown time zone')
    .optional(),
  chatUrl: z
    .string()
    .trim()
    .transform((v) => v || null)
    .refine((v) => v === null || isHttpUrl(v), 'Must be an http(s) URL')
    .nullable()
    .optional(),
  tributeTo: z
    .string()
    .trim()
    .max(80)
    .transform((v) => v || null)
    .nullable()
    .optional(),
  voteThreshold: z.number().int().min(1).max(50).optional(),
  scheduling: z.boolean().optional(),
})

/** "members.example.com" — lowercase, no scheme, port or path. */
export const Host = z
  .string()
  .trim()
  .toLowerCase()
  .transform((v) => v.replace(/^https?:\/\//, '').replace(/[/:].*$/, ''))
  .refine(
    (v) => /^(?=.{1,253}$)([a-z0-9-]{1,63}\.)*[a-z0-9-]{1,63}$/.test(v),
    'Not a web address',
  )

export function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'band'
  )
}

/** The label for a band's chat link, from where it points. */
export function chatLabel(url: string) {
  const host = (() => {
    try {
      return new URL(url).hostname
    } catch {
      return ''
    }
  })()
  if (/discord\./.test(host)) return 'Band Discord'
  if (/whatsapp\./.test(host)) return 'Band WhatsApp'
  if (/slack\./.test(host)) return 'Band Slack'
  if (/groupme\./.test(host)) return 'Band GroupMe'
  return 'Band chat'
}
