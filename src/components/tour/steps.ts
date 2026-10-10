/**
 * The first-time tour, in order. A step points at something on the page
 * (`target`, a CSS selector) or stands alone. A step on another page says
 * how to get there: `href`, or the link on the page before (`from`).
 *
 * The song and setlist steps use the tour's own samples (/tour/song,
 * /tour/setlist), so the tour is the same in every band, even a new one.
 * Steps about a tool a band can switch off (`needs`) are left out of the
 * tour in bands that have.
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
  /** Click this when the step shows (open what it's about), if it's there */
  open?: string
  /** Light this up too: what `open` opened */
  also?: string
  /** Only in bands with this tool switched on (Admin), or only in the
   * public demo */
  needs?: 'scheduling' | 'demo'
  /** A link button on the card (the demo's last step: start a band) */
  cta?: {label: string; href: string}
}

/** The band's switchable tools, as the tour needs to know them */
export type TourFeatures = {scheduling: boolean; demo?: boolean}

/** The tour for a band: without the steps about tools it has switched off */
export function stepsFor(features: TourFeatures) {
  return STEPS.filter((s) => !s.needs || features[s.needs])
}

const SONGS = /^\/songs$/
const SONG = /^\/tour\/song$/
const EDIT = /^\/tour\/edit$/
const SETLIST = /^\/tour\/setlist$/
const REHEARSALS = /^\/rehearsals$/

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
    also: '[role="group"][aria-label="Text size"]',
    title: 'Any key, any size',
    body: 'Move the chart up or down a semitone at a time; chords and notation move together. Small A, big A for the text. This device remembers both.',
  },
  {
    path: SONG,
    target: '.chart-chord:not(.chart-note):not(:empty)',
    open: '.chart-chord:not(.chart-note):not(:empty)',
    also: '[role="dialog"][aria-label$=" chord"]',
    title: 'Tap a chord',
    body: 'Any chord shows its notes on a keyboard and how to play it on guitar, with other fingerings a swipe away. Tap anywhere else to put it away.',
  },
  {
    path: SONG,
    target: '[data-notation="horn line"]',
    open: '[data-notation="horn line"] > button[aria-expanded="false"]',
    title: 'Riffs and horn lines',
    body: 'Written-out parts fold away so the chart stays easy to read on stage. Tap one to open it; the notes follow the key you’ve chosen.',
  },
  {
    path: SONG,
    target: '[data-notation="bass line"]',
    open: '[data-notation="bass line"] > button[aria-expanded="false"]',
    title: 'Tab for guitar and bass',
    body: 'Guitar and bass parts open as tab. ♪ Notes switches to notation, and this device remembers which you like.',
  },
  {
    path: SONG,
    target: '[data-tour="cues"]',
    title: 'Your own cues',
    body: 'Add notes, a photo of a few bars, or notation anywhere on the chart. Only you see them — the band’s chart doesn’t change.',
  },
  {
    path: SONG,
    target: '[data-tour="pdf"]',
    title: 'Paper, if you want it',
    body: 'A PDF of the chart in any key, ready to print.',
  },
  {
    path: SONG,
    target: '[data-tour="history"]',
    title: 'Every version kept',
    body: 'Anyone in the band can fix a chart, and every save is kept: History shows who changed what, and an admin can put an old version back.',
  },
  {
    path: EDIT,
    href: '/tour/edit',
    target: '[data-tour="editor"]',
    title: 'Edit',
    body: 'A chart is plain text: chords in [brackets] where they change, sections, and notation. The preview redraws as you type. Paste chords-over-lyrics from anywhere and Convert does the rest. Try it — this one saves nowhere.',
  },
  {
    path: EDIT,
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
    path: REHEARSALS,
    href: '/rehearsals',
    target: '[data-tour="my-days"]',
    needs: 'scheduling',
    title: 'Your days',
    body: 'Mark the days you can’t make, or would rather not; it saves as you tap. Going away? Mark a stretch… does a whole trip at once. Days you leave alone count as free.',
  },
  {
    path: REHEARSALS,
    target: '[data-tour="best-days"]',
    needs: 'scheduling',
    title: 'A day everyone can make',
    body: 'Worked out from everyone’s days: the next ones nobody’s out, with who’d only make the evening. Set rehearsal on one, and it’s on everyone’s list and calendar.',
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
  {
    needs: 'demo',
    title: 'That’s Bandstand',
    body: 'Everything here works in your own band’s book, with your songs, and saves for everyone. Free for 30 days, no card needed; then $12 a year for the whole band.',
    cta: {
      label: 'Start your band',
      href: 'https://app.bandstand.info/start',
    },
  },
]
