/**
 * The product site's screenshots (site/img), taken from a running dev server
 * with the demo band (scripts/seed-demo.ts) -- public-domain songs only.
 * Whoever signs in is shown as the demo band's Sam, so no real name or photo
 * reaches the public site.
 *
 *   npm i --no-save puppeteer-core    # once; uses your installed Chrome
 *   node scripts/site-shots.mjs <email> <password> [http://localhost:3002]
 *   cd site/img && for f in *.png; do cwebp -q 82 "$f" -o "${f%.png}.webp" && rm "$f"; done
 */
import fs from 'fs'
import puppeteer from 'puppeteer-core'

const [email, password, base = 'http://localhost:3002'] = process.argv.slice(2)
const OUT = 'site/img'
fs.mkdirSync(OUT, {recursive: true})

const CHROME =
  process.env.CHROME ??
  [
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].find((p) => fs.existsSync(p))
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox'],
})
const PHONE = {
  width: 390,
  height: 844,
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 3,
}
const TABLET = {
  width: 1180,
  height: 820,
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
}
const DESK = {width: 1280, height: 800, deviceScaleFactor: 2}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function page(viewport, theme = 'light') {
  const p = await browser.newPage()
  await p.setViewport(viewport)
  await p.emulateMediaFeatures([{name: 'prefers-color-scheme', value: theme}])
  await p.goto(base + '/login', {waitUntil: 'networkidle0'})
  if (p.url().includes('/login')) {
    await p.type('input[type=email]', email)
    await p.type('input[type=password]', password)
    await Promise.all([
      p.waitForNavigation({waitUntil: 'networkidle0'}).catch(() => {}),
      p.click('button[type=submit]'),
    ])
  }
  await p.evaluate(async () => {
    sessionStorage.clear()
    localStorage.clear()
    await fetch('/api/account/settings', {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({tourDone: true}),
    })
    const bands = await (await fetch('/api/bands')).json()
    const demo = bands.find((b) => b.name === 'The Riverside Five')
    await fetch('/api/bands/current', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({bandId: demo.id}),
    })
  })
  return p
}

/** Whoever is signed in becomes the demo band's Sam, photo and all. */
async function anonymise(p, me) {
  await p.evaluate((me) => {
    const avatar =
      'data:image/svg+xml,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#3b6fb6"/><text x="32" y="42" font-family="Archivo,sans-serif" font-size="28" font-weight="700" fill="#fff" text-anchor="middle">S</text></svg>',
      )
    for (const img of document.querySelectorAll('img'))
      if (/avatar/i.test(img.src)) img.src = avatar
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    const names = me.filter(Boolean)
    for (let n = walk.nextNode(); n; n = walk.nextNode())
      for (const name of names)
        if (n.nodeValue.includes(name))
          n.nodeValue = n.nodeValue.split(name).join('Sam')
  }, me)
}

let ME = []
async function shot(p, name, clip) {
  await wait(800)
  await anonymise(p, ME)
  await wait(200)
  await p.screenshot({path: `${OUT}/${name}.png`, ...(clip ? {clip} : {})})
  console.log('wrote', name)
}

/** Just this element, with a margin of the page around it. */
async function element(p, selector, name, pad = 16) {
  const el = await p.$(selector)
  await el.evaluate((e, pad) => {
    e.style.padding = `${pad}px`
    e.style.margin = `-${pad}px`
    e.scrollIntoView({block: 'center'})
  }, pad)
  await wait(800)
  await anonymise(p, ME)
  await el.screenshot({path: `${OUT}/${name}.png`})
  console.log('wrote', name)
}

async function songId(p, title) {
  await p.goto(base + '/songs', {waitUntil: 'networkidle0'})
  return p.evaluate(
    (t) =>
      [...document.querySelectorAll('main ul a')]
        .find((a) => a.textContent.includes(t))
        .getAttribute('href'),
    title,
  )
}

// Who to hide: the signed-in person's names
{
  const p = await page(DESK)
  ME = await p.evaluate(async () => {
    const s = await (await fetch('/api/auth/session')).json()
    const full = s?.user?.name ?? ''
    return [full, ...full.split(' ')].filter((x) => x.length > 2)
  })
  // Songs, the book
  await p.goto(base + '/songs', {waitUntil: 'networkidle0'})
  await shot(p, 'songs', {x: 0, y: 0, width: 1280, height: 720})
  // A chart with its horn line open
  const saints = await songId(p, 'When the Saints')
  await p.goto(base + saints, {waitUntil: 'networkidle0'})
  await p.click('[data-notation="horn line"] > button')
  await wait(1500)
  await p.evaluate(() => window.scrollTo(0, 0))
  await shot(p, 'chart', {x: 0, y: 0, width: 1280, height: 800})
  await element(p, '[data-notation="horn line"]', 'notation')
  // Tab
  const susanna = await songId(p, 'Oh! Susanna')
  await p.goto(base + susanna, {waitUntil: 'networkidle0'})
  for (const b of await p.$$('[data-notation] > button[aria-expanded="false"]'))
    await b.click()
  await wait(1800)
  // The last written-out part: a guitar or bass riff, as tab
  const parts = await p.$$('[data-notation]')
  await parts[parts.length - 1].evaluate((e) => e.setAttribute('data-shot', ''))
  await element(p, '[data-shot]', 'tab')
  // History
  await p.goto(base + susanna + '/history', {waitUntil: 'networkidle0'})
  await shot(p, 'history', {x: 0, y: 0, width: 1280, height: 760})
  // Rehearsals, proposals
  await p.goto(base + '/rehearsals', {waitUntil: 'networkidle2'})
  await shot(p, 'rehearsals', {x: 0, y: 0, width: 1280, height: 760})
  await p.goto(base + '/proposals', {waitUntil: 'networkidle2'})
  // Just the list: the page is mostly margin at this width
  await shot(p, 'proposals', {x: 250, y: 52, width: 780, height: 330})
  await p.close()
}

// Phone: chord diagram, cues, setlist, songs
{
  const p = await page(PHONE)
  const saints = await songId(p, 'When the Saints')
  await shot(p, 'songs-phone')
  await p.goto(base + saints, {waitUntil: 'networkidle0'})
  const chord = await p.evaluateHandle(() =>
    [...document.querySelectorAll('.chart-chord')].find(
      (c) => c.textContent.trim() === 'Bb',
    ),
  )
  await chord.evaluate((e) => e.scrollIntoView({block: 'start'}))
  await wait(400)
  await chord.tap()
  await wait(1200)
  await shot(p, 'chord-phone')
  await p.tap('body')
  await p.evaluate(() => window.scrollTo(0, 0))
  await p.click('[data-tour="cues"]')
  await wait(900)
  await shot(p, 'cues-phone')
  await p.goto(base + '/setlists', {waitUntil: 'networkidle0'})
  const set = await p.evaluate(() =>
    document
      .querySelector('main a[href^="/setlists/"]:not([href$="/edit"])')
      .getAttribute('href'),
  )
  await p.goto(base + set, {waitUntil: 'networkidle0'})
  await shot(p, 'setlist-phone')
  await p.close()

  // Performance mode: iPad (pages) and phone (scroll), dark
  const t = await page(TABLET, 'dark')
  await t.evaluate(() =>
    localStorage.setItem('mw:perform-mode', JSON.stringify('pages')),
  )
  await t.goto(base + set.replace('/setlists/', '/perform/'), {
    waitUntil: 'networkidle0',
  })
  await wait(1500)
  await shot(t, 'perform-ipad')
  await t.close()
  const ph = await page(PHONE, 'dark')
  await ph.evaluate(() =>
    localStorage.setItem('mw:perform-mode', JSON.stringify('scroll')),
  )
  await ph.goto(base + set.replace('/setlists/', '/perform/'), {
    waitUntil: 'networkidle0',
  })
  await wait(1500)
  await shot(ph, 'perform-phone')
  await ph.close()
}

await browser.close()
