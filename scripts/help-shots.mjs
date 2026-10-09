/**
 * The Help page's screenshots, taken from a running dev server with the demo
 * band (scripts/seed-demo.ts) -- public-domain songs only.
 *
 *   npm i --no-save puppeteer-core    # once; uses your installed Chrome
 *   node scripts/help-shots.mjs <email> <password> [http://localhost:3002]
 *
 * Writes public/help/*.png, then convert them to WebP to keep them small:
 *
 *   cd public/help && for f in *.png; do cwebp -q 80 "$f" -o "${f%.png}.webp" && rm "$f"; done
 *
 * The Help page (src/app/(band)/help/page.tsx) lists each picture's size.
 */
import fs from 'fs'
import puppeteer from 'puppeteer-core'

const [email, password, base = 'http://localhost:3002'] = process.argv.slice(2)
const OUT = 'public/help'
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
  deviceScaleFactor: 2,
}
const TABLET = {
  width: 1180,
  height: 820,
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 1.5,
}
const DESK = {width: 1100, height: 760, deviceScaleFactor: 1.5}
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
    // No tour over the screenshots
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

async function shot(p, name, clip) {
  await wait(700)
  await p.screenshot({path: `${OUT}/${name}.png`, ...(clip ? {clip} : {})})
  console.log('wrote', name)
}

async function element(p, selector, name, pad = 12) {
  const el = await p.$(selector)
  await el.evaluate((e) => e.scrollIntoView({block: 'center'}))
  await wait(500)
  const b = await el.boundingBox()
  await shot(p, name, {
    x: Math.max(0, b.x - pad),
    y: Math.max(0, b.y - pad),
    width: b.width + pad * 2,
    height: b.height + pad * 2,
  })
}

// The book
{
  const p = await page(DESK)
  await p.goto(base + '/songs', {waitUntil: 'networkidle0'})
  await shot(p, 'songs', {x: 0, y: 0, width: 1100, height: 560})
  // Account menu, open
  await p.click('[aria-label="Account menu"]')
  await shot(p, 'menu', {x: 640, y: 0, width: 460, height: 560})
  await p.close()
}

// A chart, its chord popover, notation, tab, cues
{
  const p = await page(DESK)
  const saints = await songId(p, 'When the Saints')
  await p.goto(base + saints, {waitUntil: 'networkidle0'})
  await shot(p, 'chart', {x: 0, y: 0, width: 1100, height: 700})
  await p.click('.chart-keep > button[aria-expanded]')
  await wait(1500)
  await element(p, '.chart-abc', 'notation')
  await p.close()
}
{
  const p = await page(PHONE)
  const saints = await songId(p, 'When the Saints')
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
  await shot(p, 'chord')
  // Cues: the editing mode and the cues on the chart
  await p.tap('body')
  await p.evaluate(() => window.scrollTo(0, 0))
  await p.click('[data-tour="cues"]')
  await wait(900)
  await shot(p, 'cues')
  await p.close()
}
{
  const p = await page(DESK)
  const susanna = await songId(p, 'Oh! Susanna')
  await p.goto(base + susanna, {waitUntil: 'networkidle0'})
  for (const b of await p.$$('.chart-keep > button[aria-expanded]'))
    await b.click()
  await wait(1800)
  await element(p, 'main', 'tab', 0)
  await p.goto(base + susanna + '/history', {waitUntil: 'networkidle0'})
  await shot(p, 'history', {x: 0, y: 0, width: 1100, height: 700})
  await p.close()
}

// Setlists and performance mode
{
  const p = await page(DESK)
  await p.goto(base + '/setlists', {waitUntil: 'networkidle0'})
  const set = await p.evaluate(() =>
    document
      .querySelector('main a[href^="/setlists/"]:not([href$="/edit"])')
      .getAttribute('href'),
  )
  await p.goto(base + set, {waitUntil: 'networkidle0'})
  await shot(p, 'setlist', {x: 0, y: 0, width: 1100, height: 720})
  await p.close()
  const t = await page(TABLET, 'dark')
  await t.evaluate(() =>
    localStorage.setItem('mw:perform-mode', JSON.stringify('pages')),
  )
  await t.goto(base + set.replace('/setlists/', '/perform/'), {
    waitUntil: 'networkidle0',
  })
  await wait(1500)
  await shot(t, 'perform')
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

// Rehearsals, proposals, account
{
  const p = await page(DESK)
  await p.goto(base + '/rehearsals', {waitUntil: 'networkidle2'})
  await shot(p, 'rehearsals', {x: 0, y: 0, width: 1100, height: 720})
  await p.goto(base + '/proposals', {waitUntil: 'networkidle2'})
  await shot(p, 'proposals', {x: 0, y: 0, width: 1100, height: 620})
  await p.goto(base + '/account', {waitUntil: 'networkidle2'})
  await shot(p, 'account', {x: 0, y: 0, width: 1100, height: 720})
  // The tour, one step in
  await p.goto(base + '/songs?tour', {waitUntil: 'networkidle2'})
  await wait(1200)
  await p.evaluate(() =>
    [...document.querySelectorAll('[aria-label="Tour"] button')]
      .find((x) => x.textContent === 'Next')
      .click(),
  )
  await wait(1500)
  await shot(p, 'tour', {x: 0, y: 0, width: 1100, height: 520})
  await p.evaluate(() =>
    [...document.querySelectorAll('[aria-label="Tour"] button')]
      .find((x) => /Skip/.test(x.textContent))
      .click(),
  )
  await p.close()
}

await browser.close()
