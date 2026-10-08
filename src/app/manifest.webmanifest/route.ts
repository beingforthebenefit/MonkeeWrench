export const dynamic = 'force-dynamic'

import {getServerSession} from 'next-auth'
import {authOptions} from '@/lib/auth'
import {brandForRequest, currentBand, iconUrl, PRODUCT} from '@/lib/band'
import {prisma} from '@/lib/db'
import {THEME_COLORS} from '@/lib/theme'

/**
 * "Add to Home Screen": the band's name and icon. The address decides it
 * when it belongs to a band; otherwise the band chosen on this device.
 */
export const GET = async () => {
  const brand = await brandForRequest()
  let band = brand.band
  if (!band) {
    const session = await getServerSession(authOptions)
    const user = session?.user?.email
      ? await prisma.user.findUnique({where: {email: session.user.email}})
      : null
    if (user) band = (await currentBand(user.id)).band
  }
  const name = band?.appName ?? PRODUCT
  return Response.json(
    {
      name,
      short_name: name,
      description: band
        ? `Charts, setlists and rehearsals for ${band.name}`
        : 'Charts, setlists and rehearsals for bands',
      start_url: '/songs',
      scope: '/',
      display: 'standalone',
      background_color: THEME_COLORS.dark,
      theme_color: THEME_COLORS.dark,
      icons: band?.iconAt
        ? [{src: iconUrl(band), sizes: '512x512', type: 'image/png'}]
        : [
            {
              src: '/icons/default-192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: '/icons/default-512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: '/icons/default-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
    },
    {headers: {'Content-Type': 'application/manifest+json'}},
  )
}
