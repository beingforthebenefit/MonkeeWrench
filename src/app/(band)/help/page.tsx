import type {ReactNode} from 'react'
import TourButton from '@/components/tour/TourButton'

export const metadata = {title: 'Help'}

/**
 * Everything the app does, by where you find it, with a picture of each.
 * The pictures come from the demo band (scripts/seed-demo.ts) and are
 * retaken with scripts/help-shots.mjs when screens change.
 */

const SECTIONS = [
  {id: 'book', title: 'The book'},
  {id: 'chart', title: 'A chart'},
  {id: 'chords', title: 'Chords'},
  {id: 'notation', title: 'Riffs and horn lines'},
  {id: 'cues', title: 'Your cues'},
  {id: 'history', title: 'Editing and history'},
  {id: 'setlists', title: 'Setlists'},
  {id: 'perform', title: 'Performance mode'},
  {id: 'pedals', title: 'Page-turn pedals'},
  {id: 'rehearsals', title: 'Rehearsals'},
  {id: 'proposals', title: 'Proposals'},
  {id: 'bands', title: 'More than one band'},
  {id: 'account', title: 'Your account'},
  {id: 'install', title: 'Install the app'},
  {id: 'offline', title: 'Without signal'},
  {id: 'notifications', title: 'Notifications'},
  {id: 'admins', title: 'For admins'},
]

export default function HelpPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-5">
      <h1 className="text-3xl font-extrabold">How it all works</h1>
      <p className="mt-2 text-[17px] text-muted">
        Everything the app does, with a picture of each. For the short version,
        take the tour: it walks through the real screens.
      </p>
      <div className="mt-4">
        <TourButton />
      </div>

      <nav aria-label="On this page" className="mt-6 flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="rounded-full border border-line-2 px-3 py-1.5 text-sm text-text no-underline hover:border-text"
          >
            {s.title}
          </a>
        ))}
      </nav>

      <Section id="book" title="The book">
        <Shot
          src="songs"
          w={1650}
          h={840}
          alt="The song list with search and filters"
        />
        <ul>
          <li>Every song the band plays, with its key on the right.</li>
          <li>
            Search by title, singer or writer. <b>Gig-ready</b> songs have a
            green dot; <b>Learning</b> shows the ones with a chart that aren’t
            ready yet; <b>Needs chart</b> shows the ones without one.
          </li>
          <li>
            A name in gold means someone edited that song in the last week.
          </li>
          <li>
            <b>Add song</b> starts a new one: paste a chart in, or write it.
          </li>
        </ul>
      </Section>

      <Section id="chart" title="A chart">
        <Shot
          src="chart"
          w={1650}
          h={1050}
          alt="A song’s chart with key and size controls"
        />
        <ul>
          <li>
            <b>− F +</b> moves the whole chart up or down a semitone. Chords and
            notation move together; <b>Back to F</b> returns to the written key.
          </li>
          <li>
            <b>Small A, big A</b> sets the text size. Both the key and the size
            are remembered on each device.
          </li>
          <li>
            Every section is written out in full — no “same as verse 1” to go
            looking for.
          </li>
          <li>
            The line under the title has the writer, lead singer, length, and a
            link to the recording. Notes about the song sit just below it.
          </li>
          <li>
            <b>PDF</b> prints the chart in whatever key you’re looking at. In
            the app on an iPhone or iPad it opens the share sheet, for{' '}
            <b>Save to Files</b>, <b>Print</b> or sending it on.
          </li>
        </ul>
      </Section>

      <Section id="chords" title="Chords">
        <Shot
          src="chord"
          w={780}
          h={1688}
          alt="A chord’s notes on a keyboard and its guitar shape"
          narrow
        />
        <ul>
          <li>
            <b>Tap any chord</b> (or rest the mouse on it) to see its notes on a
            keyboard and how to play it on guitar.
          </li>
          <li>
            The arrows beside the guitar shape step through other ways to play
            it, easiest first.
          </li>
          <li>Tap anywhere else to put it away.</li>
        </ul>
      </Section>

      <Section id="notation" title="Riffs and horn lines">
        <Shot
          src="notation"
          w={786}
          h={371}
          alt="A horn line written out as notation"
        />
        <Shot
          src="tab"
          w={1650}
          h={959}
          alt="Guitar and bass riffs shown as tab"
        />
        <ul>
          <li>
            Written-out parts — horn lines, riffs, intros — fold down to their
            name (<b>▶ Horn line</b>) so the chart stays easy to read on stage.
            Tap the name, or <b>♪ Show</b>, to open one.
          </li>
          <li>
            <b>Notes | Tab</b> switches a part between notation and tab. Guitar
            and bass parts open as tab, everything else as notation; each device
            remembers your choice.
          </li>
          <li>They follow the chart when you change its key.</li>
          <li>
            A part wider than the screen scrolls sideways; a fade on the edge
            shows there’s more.
          </li>
        </ul>
      </Section>

      <Section id="cues" title="Your cues">
        <Shot
          src="cues"
          w={780}
          h={1688}
          alt="Adding your own cues to a chart"
          narrow
        />
        <ul>
          <li>
            <b>My cues</b> lets you add your own notes to a chart: a reminder, a
            photo of a few bars of sheet music, or notation you write yourself.
          </li>
          <li>
            Put them at the top of the song or on any section.{' '}
            <b>Only you see them</b>; the band’s chart doesn’t change.
          </li>
          <li>They show in performance mode too.</li>
        </ul>
      </Section>

      <Section id="history" title="Editing and history">
        <Shot
          src="history"
          w={1650}
          h={1050}
          alt="A song’s versions, newest first"
        />
        <ul>
          <li>
            Anyone in the band can fix a chart: <b>Edit</b> shows the text with
            a live preview. Chords go in square brackets before the word they’re
            on: <code>[G]Walking the [C]dog</code>.
          </li>
          <li>
            <b>♪ Insert notation</b> adds a part written in ABC, a simple text
            way of writing music, with a live preview.
          </li>
          <li>
            Every save is kept. <b>History</b> shows who changed what and when,
            the differences between versions, and a PDF of any of them. An admin
            can put an old version back, which saves it as a new one — nothing
            is ever lost.
          </li>
          <li>
            If two people edit at once, the second save is stopped rather than
            overwriting the first.
          </li>
        </ul>
      </Section>

      <Section id="setlists" title="Setlists">
        <Shot
          src="setlist"
          w={1650}
          h={1080}
          alt="A gig’s setlist in two sets with a break"
        />
        <ul>
          <li>
            A gig’s songs in order, divided into sets with breaks between. Give
            the gig a start time and each set’s times are worked out for you.
          </li>
          <li>
            Each song can have its own key and a note (“Lou sings · up a step”,
            who plays what).
          </li>
          <li>
            Drag songs to reorder them. <b>PDF of the set</b> prints every chart
            in order, each in its set key.
          </li>
          <li>
            <b>▶ Perform</b> opens the set in performance mode.
          </li>
        </ul>
      </Section>

      <Section id="perform" title="Performance mode">
        <Shot
          src="perform"
          w={1770}
          h={1230}
          alt="Performance mode on a tablet, in pages"
        />
        <Shot
          src="perform-phone"
          w={780}
          h={1688}
          alt="Performance mode on a phone, scrolling"
          narrow
        />
        <ul>
          <li>
            Full screen, just the chart, with the song’s key beside its title,
            the set note under it, and the next song at the bottom. The whole
            set loads up front and the screen stays awake.
          </li>
          <li>
            <b>Pages</b> (tablets and computers) fits the song to the screen in
            columns; a long song turns into pages rather than tiny text.{' '}
            <b>Scroll</b> (phones) is one tall column you never have to scroll
            back up. Switch with the button at the top.
          </li>
          <li>
            <b>Turn the page</b> by tapping the left or right edge of the screen
            or swiping. At the end of the song it moves to the next one.{' '}
            <b>More ›</b> in the corner means there’s more of this song;{' '}
            <b>■ End</b> means you’re at the end.
          </li>
          <li>
            <b>Small A, big A</b> make the text smaller or bigger; bigger text
            spreads over more pages.
          </li>
          <li>
            Tap a chord to see it, or a folded part to open it, without turning
            the page.
          </li>
        </ul>
      </Section>

      <Section id="pedals" title="Page-turn pedals">
        <ul>
          <li>
            Any <b>Bluetooth page-turn pedal</b> works — AirTurn, PageFlip,
            Donner, iRig BlueTurn and the like. Pair it with your phone or iPad
            in Bluetooth settings, as you would a keyboard.
          </li>
          <li>
            Set it to send <b>arrow keys</b> or <b>Page Up / Page Down</b> (most
            do out of the box). Right, Down, Page Down or the space bar go
            forward; Left, Up or Page Up go back.
          </li>
          <li>
            In pages, the pedal turns the page, then moves to the next song. In
            scroll, it scrolls a screenful, then moves to the next song.
          </li>
          <li>
            On an iPad, a pedal paired as a keyboard hides the on-screen
            keyboard. That’s normal; there’s nothing to type in performance
            mode.
          </li>
        </ul>
      </Section>

      <Section id="rehearsals" title="Rehearsals">
        <Shot
          src="rehearsals"
          w={1650}
          h={1080}
          alt="The rehearsal grid with everyone’s days off"
        />
        <ul>
          <li>
            Mark the days you can’t make: <b>Out</b>, <b>PM out</b> (out in the
            afternoon), or <b>Prefer not</b> (you can if you must). Days you
            leave alone count as free.
          </li>
          <li>
            The best dates for the next two weeks are worked out from everyone’s
            marks. Anyone who hasn’t answered yet is named, and never counted as
            free.
          </li>
          <li>
            Scheduled rehearsals show the time and place, with a map link and
            buttons to add them to your calendar.
          </li>
          <li>
            <b>Subscribe to rehearsals and gigs</b> puts every band’s rehearsals
            and gigs in your phone’s calendar, kept up to date by itself. Each
            gig shows its venue and set times.
          </li>
        </ul>
      </Section>

      <Section id="proposals" title="Proposals">
        <Shot
          src="proposals"
          w={1650}
          h={930}
          alt="Songs proposed and their votes"
        />
        <ul>
          <li>
            Suggest a song for the band to learn, with a link to a recording.
          </li>
          <li>
            Everyone votes. When a song gets enough votes (an admin sets how
            many) it joins the book as a song to learn.
          </li>
        </ul>
      </Section>

      <Section id="bands" title="More than one band">
        <Shot
          src="menu"
          w={690}
          h={840}
          alt="The account menu with Switch band"
          narrow
        />
        <ul>
          <li>
            In several bands? Each one only sees its own songs and people.
            Switch from the menu under your picture; each device remembers the
            last band you chose.
          </li>
          <li>
            Your days off are shared by all your bands (or kept separate: see
            Account). A rehearsal or gig with one band marks you as busy in the
            others — they see “busy with another band”, not which.
          </li>
          <li>
            A link to a chart in another of your bands switches band for you.
          </li>
        </ul>
      </Section>

      <Section id="account" title="Your account">
        <Shot src="account" w={1650} h={1080} alt="Account and settings" />
        <ul>
          <li>Your photo, your password, and how you appear to the band.</li>

          <li>
            Across your bands: share your days off with all of them or not, and
            whether a gig with one marks you busy in the others.
          </li>
          <li>
            <b>Recent changes</b> (in the menu) shows what everyone has changed,
            everywhere.
          </li>
        </ul>
      </Section>

      <Section id="install" title="Install the app">
        <Shot
          src="app"
          w={768}
          h={644}
          alt="The app section of Account: install and notifications"
          narrow
        />
        <ul>
          <li>
            Installed, it opens from your home screen like any app: full screen,
            with the band’s icon, no browser bars. It also works without signal
            and can send you notifications.
          </li>
          <li>
            <b>iPhone or iPad:</b> open it in <b>Safari</b>, tap <b>Share</b>{' '}
            (the square with an arrow), then <b>Add to Home Screen</b> →{' '}
            <b>Add</b>. From then on, open it from the home screen.
          </li>
          <li>
            <b>Android:</b> in Chrome, the <b>⋮</b> menu → <b>Install app</b>{' '}
            (or <b>Add to home screen</b>).
          </li>
          <li>
            <b>A computer:</b> in Chrome or Edge, the install icon at the right
            of the address bar. Safari on a Mac: File → <b>Add to Dock</b>.
          </li>
          <li>
            Where the browser can do it for you,{' '}
            <b>Account → The app on this device</b> has an <b>Install app</b>{' '}
            button; otherwise it shows the steps for your phone.
          </li>
          <li>
            The <b>◐</b> button at the top switches between light and dark.
          </li>
        </ul>
      </Section>

      <Section id="offline" title="Without signal">
        <ul>
          <li>
            Every page you open is kept on your device. With no signal you still
            get the saved copy, and an <b>Offline</b> tag shows at the top.
          </li>
          <li>
            <b>Opening a setlist saves the whole gig</b> — performance mode and
            every chart in it — and says <b>✓ Saved for offline</b> once it’s
            all on your device (or how many of them saved, if some didn’t).
            Going straight to <b>Perform</b> saves the same. Do it once before
            you leave and the gig works in a basement with no bars.
          </li>
          <li>
            When the signal’s back you get the latest again. A page you’ve never
            opened can’t be shown offline; it says so.
          </li>
          <li>Signing out or switching band clears what’s saved.</li>
        </ul>
      </Section>

      <Section id="notifications" title="Notifications">
        <ul>
          <li>
            Turn them on in <b>Account → The app on this device</b>, once on
            each phone, tablet or computer you want them on.
          </li>
          <li>
            You hear when <b>someone else</b> changes a chart, a setlist, a
            rehearsal or a proposal — never about your own changes. A burst of
            edits comes as one notification. Tap it to open what changed.
          </li>
          <li>
            Choose which of those you want under <b>Tell me about</b>; that goes
            for all your devices. <b>Send a test</b> checks it’s working.
          </li>
          <li>
            <b>iPhone and iPad</b> only give notifications to apps on the home
            screen: install it first (above), open it from the home screen, then
            turn them on. Android and computers work in the browser too.
          </li>
          <li>
            Turned them off by mistake in the phone’s settings? Turn them back
            on there (Settings → Notifications → the app), then in Account.
          </li>
        </ul>
      </Section>

      <Section id="admins" title="For admins">
        <ul>
          <li>
            <b>Band members</b> (menu): add people and make each one a password;
            it’s shown once, with a message ready to send them. You can reset a
            password or set someone’s photo.
          </li>
          <li>
            <b>Admin</b> (menu): the band’s name, the app’s name and icon on
            people’s home screens, the group-chat link, time zone, how many
            votes a proposal needs, and whether to use the rehearsal scheduling
            tool.
          </li>
          <li>
            <b>Import songs</b> (menu): bring songs and setlists in from an
            OnSong backup, Google Docs (Drive’s Download gives Word files),
            ChordPro or text files, a spreadsheet saved as CSV, or a pasted
            list. Choose what comes in; nothing already in the band changes.
          </li>
          <li>
            <b>Download everything</b> (Admin): every song, setlist and
            rehearsal in one file, to keep or to import into another Bandstand.
          </li>
          <li>
            Admins can delete songs and setlists, and put back an old version of
            a chart.
          </li>
        </ul>
      </Section>

      <div className="mt-12 rounded-2xl border border-line-2 p-5">
        <p className="font-semibold">Still stuck?</p>
        <p className="mt-1 text-muted">
          Take the tour again, or ask in the band chat.
        </p>
        <div className="mt-3">
          <TourButton />
        </div>
      </div>
    </main>
  )
}

function Section({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: ReactNode
}) {
  return (
    <section id={id} className="help-section mt-12 scroll-mt-24">
      <h2 className="text-2xl font-extrabold">{title}</h2>
      <div className="mt-3 flex flex-col gap-4 text-[16px] leading-relaxed [&_li]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </section>
  )
}

/** A screenshot from the demo band; `narrow` for a phone-shaped one. */
function Shot({
  src,
  w,
  h,
  alt,
  narrow = false,
}: {
  src: string
  w: number
  h: number
  alt: string
  narrow?: boolean
}) {
  return (
    <figure className={narrow ? 'mx-auto w-full max-w-[300px]' : ''}>
      {/* Tap for full size: on a phone the wide ones are small */}
      <a href={`/help/${src}.webp`} target="_blank" rel="noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/help/${src}.webp`}
          width={w}
          height={h}
          alt={alt}
          loading="lazy"
          className="h-auto w-full rounded-xl border border-line-2 shadow-sm"
        />
      </a>
    </figure>
  )
}
