/**
 * The first-time tour, in order. A step points at something on the page
 * (`target`, a CSS selector) or stands alone. A step on another page names
 * the link that gets there (`from`, looked up on the page before).
 */
export type TourStep = {
  title: string
  body: string
  /** Where on the page; none: a card in the middle */
  target?: string
  /** The page it's on */
  path?: RegExp
  /** The link (on the previous page) that leads to `path` */
  from?: string
}

const SONGS = /^\/songs$/
const SONG = /^\/songs\/[^/]+$/
const SETLISTS = /^\/setlists$/
const SETLIST = /^\/setlists\/[^/]+$/

export const STEPS: TourStep[] = [
  {
    path: SONGS,
    title: 'Welcome to the band’s book',
    body: 'A minute’s tour of the real screens. Skip it any time — it’s in the menu and on the Help page whenever you want it again.',
  },
  {
    path: SONGS,
    target: 'nav[aria-label="Main"]',
    title: 'Four places',
    body: 'Songs is the book. Setlists are the gigs, in order. Rehearsals is when we can all meet. Proposals is where new songs get voted in.',
  },
  {
    path: SONGS,
    target: '[role="group"][aria-label="Filter"]',
    title: 'Find a song',
    body: 'Search by title, singer or writer. Gig-ready songs have a green dot; Learning shows the ones we’re still working up.',
  },
  {
    path: SONGS,
    target: 'main ul a[href^="/songs/"]',
    title: 'Open a song',
    body: 'Tap any song for its chart. Let’s open this one.',
  },
  {
    path: SONG,
    from: 'main ul a[href^="/songs/"]',
    target: '[role="group"][aria-label="Key"]',
    title: 'Any key',
    body: 'Move the chart up or down a semitone at a time. Chords and notation move together, and this device remembers the key you chose.',
  },
  {
    path: SONG,
    target: '[role="group"][aria-label="Text size"]',
    title: 'Text size',
    body: 'Small A, big A. Remembered on this device too.',
  },
  {
    path: SONG,
    target: '.chart-chord:not(.chart-note):not(:empty)',
    title: 'Tap a chord',
    body: 'Any chord shows its notes on a keyboard and how to play it on guitar, with other fingerings a swipe away.',
  },
  {
    path: SONG,
    target: '.chart-keep > button[aria-expanded]',
    title: 'Riffs and horn lines',
    body: 'Written-out parts fold away so the chart stays easy to read on stage. Tap to open; guitar and bass parts can show as tab.',
  },
  {
    path: SONG,
    target: '[data-tour="cues"]',
    title: 'Your own cues',
    body: 'Add notes, a photo of a few bars, or notation anywhere on the chart. Only you see them — the band’s chart doesn’t change.',
  },
  {
    path: SONG,
    target: '[data-tour="history"]',
    title: 'Edit, safely',
    body: 'Anyone in the band can fix a chart with Edit. Every save is kept: History shows who changed what, and an admin can put an old version back.',
  },
  {
    path: SONG,
    target: '[data-tour="pdf"]',
    title: 'Paper, if you want it',
    body: 'A PDF of the chart in any key, ready to print.',
  },
  {
    path: SETLISTS,
    from: 'nav[aria-label="Main"] a[href="/setlists"]',
    target: 'main a[href^="/setlists/"]:not([href$="/edit"])',
    title: 'Setlists',
    body: 'Each gig’s songs in order, with sets, breaks and start times. Let’s open one.',
  },
  {
    path: SETLIST,
    from: 'main a[href^="/setlists/"]:not([href$="/edit"])',
    target: 'main a[href^="/perform/"]',
    title: 'Perform',
    body: 'Full screen, chart only, the whole set loaded up front. Tap the screen’s edges or swipe to turn — or use a Bluetooth page-turn pedal: anything that sends arrow or page keys works.',
  },
  {
    target: '[aria-label="Account menu"]',
    title: 'Everything else',
    body: 'Your photo and password, switching bands, Recent changes, and Help — with every feature explained and this tour again.',
  },
]
