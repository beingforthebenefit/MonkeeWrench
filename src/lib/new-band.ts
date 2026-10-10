import {prisma} from './db'
import {slugify} from './band-fields'
import {logActivity} from './songs'
import {trialEnd} from './hosted'
import {SAMPLE_NOTE, SAMPLE_SONGS} from './sample-songs'

/**
 * A new band with its first admin and the sample songs: from sign-up on the
 * hosted service (on a trial) and from a fresh install's setup (free).
 */
export async function startBand(
  name: string,
  userId: string,
  {trial}: {trial: boolean},
) {
  const base = slugify(name)
  let slug = base
  for (let n = 2; await prisma.band.findUnique({where: {slug}}); n++)
    slug = `${base}-${n}`
  return prisma.$transaction(async (tx) => {
    const band = await tx.band.create({
      data: trial
        ? {name, slug, paidUntil: trialEnd(), trialStartedAt: new Date()}
        : {name, slug},
    })
    await tx.membership.create({data: {userId, bandId: band.id, isAdmin: true}})
    // Something to open straight away, and for the tour to show
    for (const song of SAMPLE_SONGS)
      await tx.song.create({
        data: {
          bandId: band.id,
          title: song.title,
          writer: song.writer,
          seconds: song.seconds,
          status: 'READY',
          notes: SAMPLE_NOTE,
          updatedById: userId,
          chartVersions: {
            create: {
              number: 1,
              source: song.chart,
              authorId: userId,
              note: 'Sample song',
            },
          },
        },
      })
    await logActivity(tx, {
      bandId: band.id,
      userId,
      action: 'band.create',
      targetType: 'band',
      targetId: band.id,
      summary: `started ${band.name}`,
    })
    return band
  })
}
