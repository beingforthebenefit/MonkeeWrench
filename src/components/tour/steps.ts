/**
 * The first-time tour, in order. A step points at something on the page
 * (`target`, a CSS selector) or stands alone. A step on another page says
 * how to get there: `href`, or the link on the page before (`from`).
 *
 * The song and setlist steps use the tour's own samples (/tour/song,
 * /tour/setlist), so the tour is the same in every band, even a new one.
 */
export type TourStep = {
  title: string
  body: string
  /** Where on the page (the first of these that's there); none: a card in
   * the middle */
  target?: string | string[]
  /** The page it's on */
  path?: RegExp
  /** The link (on the previous page) that leads to `path`: the first of
   * these that's there */
  from?: string | string[]
  /** Or go straight to this page */
  href?: string
}

const SONGS = /^\/songs$/
const SONG = /^\/tour\/song$/
const SETLIST = /^\/tour\/setlist$/

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
    body: 'Tap any song for its chart. For the tour, we’ll open a sample song so you can try everything without changing anything.',
  },
  {
    path: SONG,
    href: '/tour/song',
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
    path: SONG,
    target: 'nav[aria-label="Main"] a[href="/setlists"]',
    title: 'Setlists',
    body: 'Each gig’s songs in order, with sets, breaks and start times. Here’s a sample one.',
  },
  {
    path: SETLIST,
    href: '/tour/setlist',
    target: '[data-tour="perform"]',
    title: 'Perform',
    body: 'Full screen, chart only, the whole set loaded up front. Tap the screen’s edges or swipe to turn — or use a Bluetooth page-turn pedal: anything that sends arrow or page keys works.',
  },
  {
    title: 'Take it with you',
    body: 'Add the app to your home screen: it opens like an app, works without signal (open a setlist once and the whole gig is saved), and can tell you when someone changes a chart or a setlist. Account → The app on this device has the steps for your phone.',
  },
  {
    target: '[aria-label="Account menu"]',
    title: 'Everything else',
    body: 'Account (your photo, password, installing the app and notifications), switching bands, Recent changes, and Help — with every feature explained and this tour again.',
  },
]
