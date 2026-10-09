/**
 * A demo band for screenshots (the Help page) and for trying things out:
 * "The Riverside Five", with public-domain songs only -- the repo is public,
 * and real charts are copyrighted.
 *
 *   npx tsx scripts/seed-demo.ts you@example.com
 *
 * You become an admin of it (alongside your other bands); four demo members
 * (@example.com, no passwords, so they can't sign in) fill the rehearsal grid
 * and the votes. Safe to re-run: it rebuilds the band's songs, setlist,
 * rehearsal, days off, proposals and your cues on its songs.
 */
import {PrismaClient} from '@prisma/client'

const prisma = new PrismaClient()

const SLUG = 'riverside-five'
const MEMBERS = [
  {email: 'sam@example.com', name: 'Sam Rivers', displayName: 'Sam'},
  {email: 'lou@example.com', name: 'Lou Baker', displayName: 'Lou'},
  {email: 'dee@example.com', name: 'Dee Mason', displayName: 'Dee'},
  {email: 'ray@example.com', name: 'Ray Ortiz', displayName: 'Ray'},
]

const SONGS: {
  title: string
  writer: string
  leadSinger: string
  seconds: number
  status: 'READY' | 'LEARNING'
  chart: string | null
}[] = [
  {
    title: 'When the Saints Go Marching In',
    writer: 'Traditional',
    leadSinger: 'Sam',
    seconds: 200,
    status: 'READY',
    chart: `{title: When the Saints Go Marching In}
{key: F}

{start_of_intro: Intro}
[F]   [F]   [C7]   [F]
{end_of_intro}
{start_of_abc: Horn line}
M:4/4
L:1/8
K:F
"F"z2 FA B2 c2- | c8 | "F"z2 FA B2 c2- | "C7"c8 |
"F"z2 FA B2 c2 | "F"A4 F4 | "C7"A4 G4- | "F"G8 |]
{end_of_abc}

{start_of_verse: Verse 1}
Oh when the [F]saints go marching in
Oh when the saints go marching [C7]in
Oh Lord I [F]want to [F7]be in that [Bb]number
When the [F]saints go [C7]marching [F]in
{end_of_verse}

{start_of_verse: Verse 2}
Oh when the [F]sun refuse to shine
Oh when the sun refuse to [C7]shine
Oh Lord I [F]want to [F7]be in that [Bb]number
When the [F]sun re[C7]fuse to [F]shine
{end_of_verse}

{comment: Horns take a chorus, then everyone}

{start_of_verse: Verse 3}
Oh when the [F]trumpet sounds its call
Oh when the trumpet sounds its [C7]call
Oh Lord I [F]want to [F7]be in that [Bb]number
When the [F]trumpet [C7]sounds its [F]call
{end_of_verse}
`,
  },
  {
    title: 'Oh! Susanna',
    writer: 'Stephen Foster',
    leadSinger: 'Lou',
    seconds: 170,
    status: 'READY',
    chart: `{title: Oh! Susanna}
{key: G}

{start_of_abc: Riff — guitar}
% instrument: guitar
M:4/4
L:1/8
K:G
G,B,DB, G,B,DB, | D,F,A,F, D,F,A,F, |]
{end_of_abc}
{start_of_abc: Riff — bass}
% instrument: bass
M:4/4
L:1/8
K:G clef=bass
G,,2 D,2 G,,2 D,2 | D,2 A,,2 D,2 A,,2 |]
{end_of_abc}

{start_of_verse: Verse 1}
I [G]come from Alabama with a [D]banjo on my knee
I'm [G]going to Louisiana, my [D]true love [G]for to see
{end_of_verse}

{start_of_chorus: Chorus}
[C]Oh, Susanna, oh [G]don't you cry for [D]me
For I [G]come from Alabama with a [D]banjo on my [G]knee
{end_of_chorus}

{start_of_verse: Verse 2}
It [G]rained all night the day I left, the [D]weather it was dry
The [G]sun so hot I froze to death, Su[D]sanna don't you [G]cry
{end_of_verse}

{start_of_chorus: Chorus}
[C]Oh, Susanna, oh [G]don't you cry for [D]me
For I [G]come from Alabama with a [D]banjo on my [G]knee
{end_of_chorus}
`,
  },
  {
    title: 'Down by the Riverside',
    writer: 'Traditional',
    leadSinger: 'Dee',
    seconds: 210,
    status: 'READY',
    chart: `{title: Down by the Riverside}
{key: C}

{start_of_intro: Intro}
[C]   [C]   [G7]   [C]
{end_of_intro}

{start_of_verse: Verse}
Gonna lay down my [C]burden, down by the riverside
Down by the [G7]riverside, down by the [C]riverside
Gonna lay down my burden, down by the riverside
And [G7]study war no [C]more
{end_of_verse}

{start_of_chorus: Chorus}
I ain't gonna [F]study war no more, ain't gonna [C]study war no more
Ain't gonna [G7]study war no [C]more   [C7]
I ain't gonna [F]study war no more, ain't gonna [C]study war no more
Ain't gonna [G7]study war no [C]more
{end_of_chorus}

{start_of_solo: Piano solo}
[C]   [C]   [G7]   [C]   [F]   [C]   [G7]   [C]
{end_of_solo}
`,
  },
  {
    title: 'Swing Low, Sweet Chariot',
    writer: 'Wallace Willis',
    leadSinger: 'Ray',
    seconds: 190,
    status: 'LEARNING',
    chart: `{title: Swing Low, Sweet Chariot}
{key: D}

{start_of_chorus: Chorus}
[D]Swing low, sweet [G]chari[D]ot
Coming for to carry me [A7]home
[D]Swing low, sweet [G]chari[D]ot
Coming for to [A7]carry me [D]home
{end_of_chorus}

{start_of_verse: Verse}
I [D]looked over Jordan and [G]what did I [D]see
Coming for to carry me [A7]home
A [D]band of angels [G]coming after [D]me
Coming for to [A7]carry me [D]home
{end_of_verse}
`,
  },
  {
    title: 'Amazing Grace',
    writer: 'John Newton',
    leadSinger: 'Sam',
    seconds: 180,
    status: 'LEARNING',
    chart: null,
  },
]

const day = (offset: number) => {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() + offset)
  return d
}

async function main() {
  const email = process.argv[2]
  if (!email) throw new Error('Usage: seed-demo <your email>')
  const me = await prisma.user.findFirstOrThrow({where: {email}})
  const band = await prisma.band.upsert({
    where: {slug: SLUG},
    create: {slug: SLUG, name: 'The Riverside Five'},
    update: {},
  })
  await prisma.membership.upsert({
    where: {userId_bandId: {userId: me.id, bandId: band.id}},
    create: {userId: me.id, bandId: band.id, isAdmin: true},
    update: {isAdmin: true},
  })
  const members = [me]
  for (const m of MEMBERS) {
    const u = await prisma.user.upsert({
      where: {email: m.email},
      create: {...m, availabilityUpdatedAt: new Date()},
      update: {name: m.name, displayName: m.displayName},
    })
    await prisma.membership.upsert({
      where: {userId_bandId: {userId: u.id, bandId: band.id}},
      create: {userId: u.id, bandId: band.id},
      update: {},
    })
    members.push(u)
  }

  // Start clean: songs (with charts, cues, set items), setlists, rehearsals,
  // proposals
  await prisma.setlist.deleteMany({where: {bandId: band.id}})
  await prisma.song.deleteMany({where: {bandId: band.id}})
  await prisma.rehearsal.deleteMany({where: {bandId: band.id}})
  await prisma.proposal.deleteMany({where: {bandId: band.id}})

  const songs: Record<string, string> = {}
  for (const s of SONGS) {
    const song = await prisma.song.create({
      data: {
        bandId: band.id,
        title: s.title,
        writer: s.writer,
        leadSinger: s.leadSinger,
        seconds: s.seconds,
        status: s.status,
        updatedById: me.id,
        chartVersions: s.chart
          ? {
              create: [
                {
                  number: 1,
                  source: s.chart.replace(/\n{start_of_abc[\s\S]*$/, '\n'),
                  authorId: members[1].id,
                  note: 'First go',
                },
                {
                  number: 2,
                  source: s.chart,
                  authorId: me.id,
                  note: 'Horn line and riffs written out',
                },
              ],
            }
          : undefined,
      },
    })
    songs[s.title] = song.id
  }

  // Your own cues on the Saints: a note on the top, notation on verse 1
  await prisma.cue.createMany({
    data: [
      {
        userId: me.id,
        songId: songs['When the Saints Go Marching In'],
        anchor: '',
        kind: 'TEXT',
        text: 'Count it in slow — Sam picks the tempo',
      },
      {
        userId: me.id,
        songId: songs['When the Saints Go Marching In'],
        anchor: 'verse 1#1',
        kind: 'ABC',
        text: 'L:1/8\n"F"[FAc]2 z2 [FAc]2 z2 | "Bb"[FBd]2 z2 "F"[FAc]4 |]',
      },
    ],
  })

  // Sunday's gig in two sets
  await prisma.setlist.create({
    data: {
      bandId: band.id,
      name: 'Riverside Park — Sunday',
      gigDate: day(9),
      startTime: '14:00',
      venue: 'Riverside Park bandstand, 1 River Rd',
      notes: 'Load in 1:15. Sam counts everything off.',
      updatedById: me.id,
      items: {
        create: [
          {position: 0, kind: 'SET', label: 'Set 1', minutes: 45},
          {
            position: 1,
            kind: 'SONG',
            songId: songs['When the Saints Go Marching In'],
            note: 'Horns take the 2nd chorus',
          },
          {
            position: 2,
            kind: 'SONG',
            songId: songs['Oh! Susanna'],
            key: 'A',
            note: 'Lou sings · up a step',
          },
          {position: 3, kind: 'SONG', songId: songs['Down by the Riverside']},
          {position: 4, kind: 'BREAK', minutes: 15},
          {position: 5, kind: 'SET', label: 'Set 2', minutes: 45},
          {
            position: 6,
            kind: 'SONG',
            songId: songs['Swing Low, Sweet Chariot'],
          },
          {
            position: 7,
            kind: 'SONG',
            songId: songs['When the Saints Go Marching In'],
            note: 'Big ending',
          },
        ],
      },
    },
  })

  await prisma.rehearsal.create({
    data: {
      bandId: band.id,
      date: day(4),
      time: '19:00',
      place: "Lou's garage, 12 Elm St",
      note: 'Run Sunday’s set',
      createdById: me.id,
    },
  })

  // Days off over the next two weeks, so the grid has something to say
  const marks: [number, number, 'OUT' | 'PM_OUT' | 'PREFER_NOT'][] = [
    [1, 2, 'OUT'],
    [1, 3, 'OUT'],
    [2, 5, 'PM_OUT'],
    [3, 1, 'OUT'],
    [3, 6, 'PREFER_NOT'],
    [4, 2, 'OUT'],
    [4, 8, 'OUT'],
    [0, 7, 'PM_OUT'],
    [2, 10, 'OUT'],
    [1, 12, 'PREFER_NOT'],
  ]
  for (const [m, d, kind] of marks) {
    const u = members[m]
    await prisma.unavailability.upsert({
      where: {userId_scope_date: {userId: u.id, scope: '', date: day(d)}},
      create: {userId: u.id, date: day(d), kind},
      update: {kind},
    })
  }

  // Two songs up for a vote
  const p1 = await prisma.proposal.create({
    data: {
      bandId: band.id,
      title: 'Shenandoah',
      artist: 'Traditional',
      proposerId: members[2].id,
    },
  })
  await prisma.vote.createMany({
    data: [
      {userId: members[2].id, proposalId: p1.id},
      {userId: members[3].id, proposalId: p1.id},
    ],
  })
  await prisma.proposal.create({
    data: {
      bandId: band.id,
      title: 'Camptown Races',
      artist: 'Stephen Foster',
      proposerId: members[4].id,
    },
  })

  console.log(
    `The Riverside Five: ${SONGS.length} songs, 1 setlist, 1 rehearsal, ${members.length} members`,
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
