export const dynamic = 'force-dynamic'

import {prisma} from '@/lib/db'
import {requireAdmin} from '@/lib/guard'

export const GET = async () => {
  const s = await prisma.settings.findUnique({where: {id: 1}})
  return Response.json({
    voteThreshold: s?.voteThreshold ?? 2,
    adminAllowlist: s?.adminAllowlist ?? [],
  })
}

export const PATCH = async (req: Request) => {
  await requireAdmin()
  const body = await req.json()
  const voteThreshold = Number(body.voteThreshold)
  if (!Number.isInteger(voteThreshold) || voteThreshold < 1)
    return new Response('Bad threshold', {status: 400})
  const adminAllowlist = Array.isArray(body.adminAllowlist)
    ? body.adminAllowlist.map(String)
    : undefined
  const data: any = {voteThreshold}
  if (adminAllowlist) data.adminAllowlist = adminAllowlist
  await prisma.settings.update({where: {id: 1}, data})
  return new Response(null, {status: 204})
}
