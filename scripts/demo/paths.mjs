/**
 * Which URLs the demo capture follows and where each lands on disk. Kept
 * apart from capture.mjs so the rules can be tested.
 */

/** Where the crawl starts: every page in the menu, and the tour's. */
export const SEEDS = [
  '/songs',
  '/setlists',
  '/rehearsals',
  '/proposals',
  '/help',
  '/account',
  '/activity',
  '/members',
  '/admin',
  '/bands',
  '/songs/new',
  '/tour/song',
  '/tour/setlist',
]

/** Pages with nothing to show without a server, or that act on a visit. */
export function skipPage(path) {
  return (
    path === '/' ||
    /^\/(api|_next|login|brand|help\/|icons)\b/.test(path) ||
    path.startsWith('/bands/switch') ||
    /\.[a-z0-9]+$/i.test(path)
  )
}

/**
 * GitHub Pages serves /songs from songs.html where it can, and otherwise
 * redirects to /songs/ (songs/index.html). Writing both works either way;
 * the app puts the address back to /songs once it starts.
 */
export function pageFiles(path) {
  return [`${path.slice(1)}.html`, `${path.slice(1)}/index.html`]
}

const PAGE = /href="(\/[^"#?]*)(?:[?#][^"]*)?"/g
/** Same-site page links in the HTML. */
export function pageLinks(html) {
  const found = new Set()
  for (const [, path] of html.matchAll(PAGE)) {
    const p = path.length > 1 ? path.replace(/\/$/, '') : path
    if (!skipPage(p)) found.add(p)
  }
  return found
}

// In attributes ("/api/x") and in the page's React data (\"/api/x\")
const RESOURCE = /\\?["'(](\/(?:api|brand)\/[^"'\\)\s?#]+)/g
/** Files the pages show or link to: photos, icons, PDFs, calendar files. */
export function resourceLinks(html) {
  const found = new Set(['/favicon.ico', '/manifest.webmanifest'])
  for (const [, path] of html.matchAll(RESOURCE))
    if (!/^\/api\/(auth|stream|push)\b/.test(path)) found.add(path)
  return found
}

/**
 * Where a captured file is written. GitHub Pages picks the content type
 * from the extension, so PDFs and calendar files get theirs (demo.js asks
 * for them by that name); photos stay as they are, which images don't mind.
 */
export function apiFile(path) {
  const ext = path.match(/\/(pdf|ics)$/)
  return path.slice(1) + (ext ? `.${ext[1]}` : '')
}
