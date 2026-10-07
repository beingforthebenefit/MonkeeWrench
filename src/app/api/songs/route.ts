export const dynamic = 'force-dynamic'

import {z} from 'zod'
import {prisma} from '@/lib/db'
import {requireSession} from '@/lib/guard'
import {listSongs, logActivity} from '@/lib/songs'
import {SongFields} from '@/lib/song-fields'

export const GET = async () => {
  await requireSession()
  return Response.json(await listSongs())
}

const CreateBody = SongFields.extend({
  title: z.string().trim().min(1),
  source: z.string().optional(),
})

export const POST = async (req: Request) => {
  const {user} = await requireSession()
  const parsed = CreateBody.safeParse(await req.json())
  if (!parsed.success) return new Response('Bad Request', {status: 400})
  const {source, ...fields} = parsed.data
  const song = await prisma.$transaction(async (tx) => {
    const song = await tx.song.create({
      data: {...fields, title: fields.title, updatedById: user.id},
    })
    await tx.chartVersion.create({
      data: {
        songId: song.id,
        number: 1,
        source: source?.trim() ? source : `{title: ${song.title}}\n`,
        authorId: user.id,
        note: 'Created',
      },
    })
    await logActivity(tx, {
      userId: user.id,
      action: 'song.create',
      targetType: 'song',
      targetId: song.id,
      summary: `added ${song.title}`,
    })
    return song
  })
  return Response.json({id: song.id}, {status: 201})
}
