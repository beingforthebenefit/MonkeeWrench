import {strFromU8, unzipSync} from 'fflate'

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
}
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
    e[0] === '#'
      ? String.fromCodePoint(
          e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1),
        )
      : (ENTITIES[e] ?? m),
  )

/**
 * The text of a Word file (what Google Drive's Download gives for a Doc),
 * one line per paragraph, keeping the spaces that line chords up over the
 * words. Formatting, images and tables' layout are dropped.
 */
export function docxText(bytes: Uint8Array): string {
  const files = unzipSync(bytes, {
    filter: (f) => f.name === 'word/document.xml',
  })
  const xml = files['word/document.xml']
  if (!xml) throw new Error('not a Word file')
  const body = strFromU8(xml)
  const lines: string[] = []
  for (const p of body.match(/<w:p[\s>][\s\S]*?<\/w:p>|<w:p\/>/g) ?? []) {
    let line = ''
    for (const m of p.matchAll(
      /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:(?:br|cr)(?:\s[^>]*)?\/>/g,
    )) {
      if (m[1] !== undefined) line += decode(m[1])
      else if (m[0].startsWith('<w:tab')) line += '\t'
      else line += '\n'
    }
    lines.push(line)
  }
  return lines.join('\n')
}
