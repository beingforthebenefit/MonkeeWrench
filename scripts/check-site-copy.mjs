// Fails if an em dash (U+2014, or &mdash; / &#8212;) is in the product
// site's copy (site/). Rewrite the sentence instead: a comma, a colon,
// brackets or a full stop.
import {readdir, readFile} from 'node:fs/promises'

const bad = /—|&mdash;|&#8212;/
const found = []
for (const name of await readdir('site')) {
  if (!/\.(html|css|txt|xml|svg)$/.test(name)) continue
  const lines = (await readFile(`site/${name}`, 'utf8')).split('\n')
  lines.forEach(
    (l, i) => bad.test(l) && found.push(`site/${name}:${i + 1}: ${l.trim()}`),
  )
}
if (found.length) {
  console.error(
    `${found.length} em dash(es) in the product site:\n${found.join('\n')}`,
  )
  process.exit(1)
}
console.log('site copy: no em dashes')
