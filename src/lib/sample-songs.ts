/**
 * Two full public-domain charts: the public demo's band plays them
 * (scripts/seed-demo.ts), and a band started on the hosted service gets them,
 * so its book isn't empty and the tour has something to show. Each has a
 * horn line and parts in tab, to show what a chart can hold.
 */

export const SAINTS = `{title: When the Saints Go Marching In}
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
{start_of_abc: Bass line}
% instrument: bass
M:4/4
L:1/4
K:F clef=bass
"F"F,, A,, C, D, | "F"F, D, C, A,, | "C7"C, E, G, B,, | "F"A,, C, F,, z |]
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

{start_of_solo: Horn chorus}
[F]   [F]   [F]   [C7]
[F]   [F7]   [Bb]   [Bbm]
[F]   [C7]   [F]   [F]
{end_of_solo}

{start_of_verse: Verse 3}
Oh when the [F]trumpet sounds its call
Oh when the trumpet sounds its [C7]call
Oh Lord I [F]want to [F7]be in that [Bb]number
When the [F]trumpet [C7]sounds its [F]call
{end_of_verse}

{start_of_outro: Tag}
When the [F]saints go [C7]marching [F]in   [Bb]   [F]
{end_of_outro}
`

export const RIVERSIDE = `{title: Down by the Riverside}
{key: C}

{start_of_intro: Intro}
[C]   [C]   [G7]   [C]
{end_of_intro}
{start_of_abc: Horn shout}
M:4/4
L:1/8
K:C
"C"z2 GA c2 c2 | "C"e2 dc- c4 | "G7"z2 GA B2 d2 | "C"c6 z2 |]
{end_of_abc}
{start_of_abc: Bass line}
% instrument: bass
M:4/4
L:1/4
K:C clef=bass
"C"C, E, G, A, | "C"C, E, G, E, | "G7"G,, B,, D, F, | "C"E, G,, C, z |]
{end_of_abc}
{start_of_abc: Guitar fill}
% instrument: guitar
M:4/4
L:1/8
K:C
"C"z2 _EE GA c2 | "G7"=B2 AG F2 D2 |]
{end_of_abc}

{comment: Horns stab every "no more" in the choruses}

{start_of_verse: Verse 1}
Gonna lay down my [C]burden, down by the riverside
Down by the [G7]riverside, down by the [C]riverside
Gonna lay down my burden, down by the [C7]riverside
And [G7]study war no [C]more
{end_of_verse}

{start_of_chorus: Chorus}
I ain't gonna [F]study war no more, ain't gonna [C]study war no more
Ain't gonna [G7]study war no [C]more   [C7]
I ain't gonna [F]study war no more, ain't gonna [C]study war no more
Ain't gonna [G7]study war no [C]more
{end_of_chorus}

{start_of_verse: Verse 2}
Gonna lay down my [C]sword and shield, down by the riverside
Down by the [G7]riverside, down by the [C]riverside
Gonna lay down my sword and shield, down by the [C7]riverside
And [G7]study war no [C]more
{end_of_verse}

{start_of_chorus: Chorus}
I ain't gonna [F]study war no more, ain't gonna [C]study war no more
Ain't gonna [G7]study war no [C]more   [C7]
I ain't gonna [F]study war no more, ain't gonna [C]study war no more
Ain't gonna [G7]study war no [C]more
{end_of_chorus}

{start_of_solo: Piano solo}
[C]   [C]   [G7]   [C]   [C]   [C]   [G7]   [C]
[F]   [F]   [C]   [C7]   [F]   [C]   [G7]   [C]
{end_of_solo}

{start_of_verse: Verse 3}
Gonna put on my [C]long white robe, down by the riverside
Down by the [G7]riverside, down by the [C]riverside
Gonna put on my long white robe, down by the [C7]riverside
And [G7]study war no [C]more
{end_of_verse}

{start_of_chorus: Last chorus}
I ain't gonna [F]study war no more, ain't gonna [C]study war no more
Ain't gonna [G7]study war no [C]more   [C7]
I ain't gonna [F]study war no more, ain't gonna [C]study war no more
Ain't gonna [G7]study war no [C]more
{end_of_chorus}

{start_of_outro: Ending}
Ain't gonna [G7]study war no [C]more   [F]   [C]   [G7]   [C]
{end_of_outro}
`

/** For a new band: the songs, marked as samples to delete when done. */
export const SAMPLE_SONGS = [
  {
    title: 'When the Saints Go Marching In',
    writer: 'Traditional',
    seconds: 200,
    chart: SAINTS,
  },
  {
    title: 'Down by the Riverside',
    writer: 'Traditional',
    seconds: 210,
    chart: RIVERSIDE,
  },
]

export const SAMPLE_NOTE =
  'A sample song, to try things out: change the key, tap a chord, open the horn line. Delete it when you’re done (Edit → Delete this song).'
