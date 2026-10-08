export const dynamic = 'force-dynamic'

import {cookies} from 'next/headers'
import {requireUser} from '@/lib/guard'
import {BAND_COOKIE, myBands} from '@/lib/band'

/**
 * /bands/switch?to=<band id>&next=/songs/abc — follows a link to another of
 * your bands' pages (e.g. a shared chart link) by switching band first.
 * Only to bands you're in; otherwise it just goes to the picker.
 */
export const GET = async (req: Request) => {
  const url = new URL(req.url)
  const to = url.searchParams.get('to') ?? ''
  const raw = url.searchParams.get('next') ?? '/songs'
  const next = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/songs'
  const back = (path: string) =>
    new Response(null, {status: 303, headers: {Location: path}})
  let userId: string
  try {
    userId = (await requireUser()).user.id
  } catch {
    return back('/login?callbackUrl=' + encodeURIComponent(next))
  }
  const bands = await myBands(userId)
  if (!bands.some((b) => b.id === to)) return back('/bands')
  cookies().set(BAND_COOKIE, to, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 400 * 24 * 60 * 60,
  })
  return back(next)
}
