export const dynamic = 'force-dynamic'

import {z} from 'zod'
import {prisma} from '@/lib/db'
import {requireOwner} from '@/lib/guard'
import {Host} from '@/lib/band-fields'
import {route} from '@/lib/route'

const Body = z.object({domains: z.array(Host).max(10)})

/**
 * The web addresses that belong to a band (owner only: each one also needs
 * DNS, a proxy route and, for Google sign-in, a redirect URI).
 */
export const PUT = route(
  async (req: Request, {params}: {params: {id: string}}) => {
    await requireOwner()
    const parsed = Body.safeParse(await req.json())
    if (!parsed.success)
      return Response.json(
        {error: 'One of those isn’t a web address.'},
        {status: 400},
      )
    const band = await prisma.band.findUnique({where: {id: params.id}})
    if (!band) return new Response('Not Found', {status: 404})
    const hosts = [...new Set(parsed.data.domains)]
    const taken = await prisma.bandDomain.findFirst({
      where: {host: {in: hosts}, bandId: {not: band.id}},
      include: {band: {select: {name: true}}},
    })
    if (taken)
      return Response.json(
        {error: `${taken.host} already belongs to ${taken.band.name}.`},
        {status: 409},
      )
    await prisma.$transaction([
      prisma.bandDomain.deleteMany({where: {bandId: band.id}}),
      prisma.bandDomain.createMany({
        data: hosts.map((host) => ({host, bandId: band.id})),
      }),
    ])
    return new Response(null, {status: 204})
  },
)
