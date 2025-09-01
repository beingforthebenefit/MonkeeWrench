import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const Body = z.object({
  ids: z.array(z.string()).min(1),
})

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email ?? ''
  if (!email) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const me = await prisma.user.findUnique({ where: { email } })
  if (!me?.isAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const json = await req.json().catch(() => null)
  const parsed = Body.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const { ids } = parsed.data

  // Verify all ids are approved & unarchived; reject if mismatch.
  const approved = await prisma.proposal.findMany({
    where: { status: 'APPROVED' },
    select: { id: true },
  })
  const approvedSet = new Set(approved.map(p => p.id))
  for (const id of ids) {
    if (!approvedSet.has(id)) {
      return NextResponse.json({ error: `id_not_reorderable:${id}` }, { status: 400 })
    }
  }

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < ids.length; i++) {
      await tx.proposal.update({
        where: { id: ids[i] },
        data: { setlistOrder: i + 1 },
      })
    }
  })

  // Optional: notify SSE listeners
  try { await fetch(`${process.env.NEXTAUTH_URL}/api/stream/emit`, { method: 'POST', body: JSON.stringify({ type: 'setlist_reordered' }) }) } catch {}

  return NextResponse.json({ ok: true })
}
