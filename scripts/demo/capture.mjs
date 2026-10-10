/**
 * Save a running demo build of the app as static files: every page the demo
 * member can reach, as served (so it hydrates and runs like the real thing),
 * plus the PDFs, calendar files and images those pages link to. Run by
 * scripts/demo.sh; see there.
 *
 *   node scripts/demo/capture.mjs <base url> <out dir> <email> <password>
 */
import {mkdir, writeFile} from 'node:fs/promises'
import {dirname, join} from 'node:path'
import {
  SEEDS,
  apiFile,
  pageFiles,
  pageLinks,
  resourceLinks,
  skipPage,
} from './paths.mjs'

const [base, out, email, password] = process.argv.slice(2)
if (!base || !out || !email || !password) {
  console.error('Usage: capture.mjs <base url> <out dir> <email> <password>')
  process.exit(2)
}

const jar = new Map()
function keep(res) {
  for (const c of res.headers.getSetCookie()) {
    const [pair] = c.split(';')
    const i = pair.indexOf('=')
    jar.set(pair.slice(0, i), pair.slice(i + 1))
  }
}
const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ')
// Pages are asked for as if at the demo's own address, which they show in
// places (the sign-in link on Members)
const host = process.env.DEMO_HOST || 'bandstand.info'
const headers = () => ({
  cookie: cookie(),
  'x-forwarded-host': host,
  'x-forwarded-proto': 'https',
})
const get = (path) =>
  fetch(base + path, {headers: headers(), redirect: 'manual'})

async function signIn() {
  const r = await get('/api/auth/csrf')
  keep(r)
  const {csrfToken} = await r.json()
  const res = await fetch(base + '/api/auth/callback/credentials', {
    method: 'POST',
    redirect: 'manual',
    headers: {
      cookie: cookie(),
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({csrfToken, email, password, json: 'true'}),
  })
  keep(res)
  if (![...jar.keys()].some((k) => k.endsWith('next-auth.session-token')))
    throw new Error(`Sign-in as ${email} failed (${res.status})`)
}

async function save(rel, body) {
  const file = join(out, rel)
  await mkdir(dirname(file), {recursive: true})
  await writeFile(file, body)
}

await signIn()

const seen = new Set()
const queue = [...SEEDS]
// Import reads files in the browser with SQLite (the wasm), and Admin's
// "Download everything" is the demo band's own export
const resources = new Set([
  '/api/auth/session',
  '/api/import/sqlite',
  '/api/export',
])
const missing = []
let pages = 0
while (queue.length) {
  const path = queue.shift()
  if (seen.has(path) || skipPage(path)) continue
  seen.add(path)
  const res = await get(path)
  if (res.status !== 200) {
    missing.push(`${res.status} ${path}`)
    continue
  }
  const html = await res.text()
  for (const f of pageFiles(path)) await save(f, html)
  pages++
  for (const p of pageLinks(html)) if (!seen.has(p)) queue.push(p)
  for (const p of resourceLinks(html)) resources.add(p)
  // The PDF dialog builds its link on the page, so it isn't in the HTML
  const m = path.match(/^\/(songs|setlists)\/([^/]+)$/)
  if (m && m[2] !== 'new') resources.add(`/api/${m[1]}/${m[2]}/pdf`)
}

let files = 0
for (const path of resources) {
  // The favicon redirects to the band's icon
  const res = await fetch(base + path, {headers: {cookie: cookie()}})
  if (res.status !== 200) {
    missing.push(`${res.status} ${path}`)
    continue
  }
  await save(apiFile(path), Buffer.from(await res.arrayBuffer()))
  files++
}

console.log(`Captured ${pages} pages and ${files} files into ${out}`)
if (missing.length) console.log(`Not captured:\n  ${missing.join('\n  ')}`)
// A demo with no songs in it means something upstream went wrong
if (![...seen].some((p) => /^\/songs\/(?!new$)[^/]+$/.test(p))) {
  console.error('No song pages were captured')
  process.exit(1)
}
