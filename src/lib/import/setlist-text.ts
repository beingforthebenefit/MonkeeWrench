import type {SetlistIn} from '../band-import-schema'

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/^(the|a|an)\s+/, '')
    .replace(/[^a-z0-9]+/g, '')

/**
 * A setlist typed or pasted as a list: one song a line; "Set 1", "Encore"
 * start a set; "Break" or "Break 15" is a break. Numbers, bullets and a key
 * in brackets ("Proud Mary [D]") are understood. Each song is matched to one
 * the band has (or is importing), ignoring case, punctuation and a leading
 * "The"; the rest come back as `unknown`.
 */
export function readSetlistText(
  name: string,
  text: string,
  titles: string[],
): {setlist: SetlistIn; unknown: string[]} {
  const byNorm = new Map<string, string>()
  for (const t of titles) if (!byNorm.has(norm(t))) byNorm.set(norm(t), t)
  const items: SetlistIn['items'] = []
  const unknown: string[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw
      .replace(/^\s*(?:\d+[.)]|[-*•–])\s*/, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (!line) continue
    const set = line.match(
      /^(set\s*\d+|set\s*[ivx]+|encores?|first set|second set|third set)\s*:?\s*(?:\((\d+)\s*min\w*\))?$/i,
    )
    if (set) {
      items.push({
        set: set[1].replace(/^\w/, (c) => c.toUpperCase()),
        minutes: set[2] ? +set[2] : null,
      })
      continue
    }
    const brk = line.match(/^(?:break|intermission|interval|pause)\b\D*(\d+)?/i)
    if (brk && line.length < 30) {
      items.push({break: brk[1] ? +brk[1] : null})
      continue
    }
    const keyed = line.match(
      /^(.*?)\s*[[(]\s*(?:in\s+)?([A-G][#b]?m?)\s*[\])]$/,
    )
    const title = (keyed ? keyed[1] : line).trim()
    const hit = byNorm.get(norm(title))
    if (!hit) {
      unknown.push(title)
      continue
    }
    items.push({song: hit, key: keyed?.[2] ?? null})
  }
  return {setlist: {name, items}, unknown}
}
