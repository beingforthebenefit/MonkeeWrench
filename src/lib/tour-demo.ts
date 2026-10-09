/**
 * The tour's own song and setlist, so it shows every feature the same way
 * whichever band is selected (and before a band has any charts). Public
 * domain only: the repo is public. Nothing here is saved anywhere.
 */
import type {Cue} from './cues'

export const DEMO_SONG = {
  id: 'tour-demo',
  title: 'When the Saints Go Marching In',
  writer: 'Traditional',
  leadSinger: 'Sam',
  guitars: null,
  seconds: 200,
  keys: null,
  percussion: null,
  youtubeUrl: null,
  lyricsUrl: null,
  notes: null,
  ready: true,
}

export const DEMO_CHART = `{title: When the Saints Go Marching In}
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
`

export const DEMO_CUES: Cue[] = [
  {
    id: 'tour-cue-1',
    anchor: '',
    position: 0,
    kind: 'TEXT',
    text: 'Count it in slow — Sam picks the tempo',
    image: null,
  },
]

type DemoItem = {
  id: string
  kind: 'SONG' | 'SET' | 'BREAK'
  label?: string
  minutes?: number
  song?: {title: string; seconds: number}
  key?: string
  note?: string
}

const saints = {title: DEMO_SONG.title, seconds: DEMO_SONG.seconds}

/** A gig in two sets with a break: the same shape as a real one. */
export const DEMO_SETLIST: {
  name: string
  date: string
  venue: string
  startTime: string
  notes: string
  items: DemoItem[]
} = {
  name: 'Riverside Park',
  date: 'Sunday, June 7',
  venue: 'Riverside Park bandstand',
  startTime: '14:00',
  notes: 'Load in 1:15. Sam counts everything off.',
  items: [
    {id: 's1', kind: 'SET', label: 'Set 1', minutes: 45},
    {
      id: 'a',
      kind: 'SONG',
      song: saints,
      key: 'F',
      note: 'Horns take the 2nd chorus',
    },
    {
      id: 'b',
      kind: 'SONG',
      song: {title: 'Oh! Susanna', seconds: 170},
      key: 'A',
      note: 'Lou sings · up a step',
    },
    {
      id: 'c',
      kind: 'SONG',
      song: {title: 'Down by the Riverside', seconds: 210},
      key: 'C',
    },
    {id: 'br', kind: 'BREAK', minutes: 15},
    {id: 's2', kind: 'SET', label: 'Set 2', minutes: 45},
    {
      id: 'd',
      kind: 'SONG',
      song: {title: 'Swing Low, Sweet Chariot', seconds: 190},
      key: 'D',
    },
    {
      id: 'e',
      kind: 'SONG',
      song: saints,
      key: 'G',
      note: 'Big ending, up a step',
    },
  ],
}
