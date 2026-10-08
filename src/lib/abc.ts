import {transposeKey} from './chordpro'

/**
 * ABC notation (abcnotation.com): music as text. `"C"B2 B2 | "G"B4 |]` is
 * two bars with chord symbols. People type only the music; the header ABC
 * requires is added here, in the song's key so that transposing the chart
 * transposes the notation the same way.
 */
export function withAbcHeader(abc: string, key = 'C') {
  const text = abc.replace(/\r\n?/g, '\n').trim()
  const has = (field: string) => new RegExp(`^${field}:`, 'm').test(text)
  const head = [
    has('X') ? null : 'X:1',
    has('M') ? null : 'M:4/4',
    has('L') ? null : 'L:1/8',
    has('K') ? null : `K:${key}`,
  ].filter(Boolean)
  // K: must be the last header line, so ours go before anything typed
  return [...head, text].join('\n')
}

/** Starter patterns for the notation editor, in `key` (the song's key). */
export function abcPresets(key: string | null) {
  const k = key ?? 'C'
  const I = k
  const IV = transposeKey(k, 5)
  const V = transposeKey(k, 7)
  const rhythm = `K:${k} style=rhythm\n`
  // Scale steps up from the key's note (ABC: C-B, then c-b an octave up)
  const LETTERS = 'CDEFGAB'
  const root = Math.max(0, LETTERS.indexOf(k[0]))
  const n = (step: number) => {
    const i = root + step
    const letter = LETTERS[i % 7]
    return i < 7 ? letter : letter.toLowerCase()
  }
  return [
    {
      name: 'Straight 8ths',
      abc: `${rhythm}"${I}"BBBB BBBB | "${V}"BBBB BBBB |]`,
    },
    {
      name: 'Push the and of 4',
      abc: `${rhythm}"${I}"B2 B2 B2 B"${IV}"B- | B8 |]`,
    },
    {
      name: 'Stabs on 1 and the and of 2',
      abc: `${rhythm}"${I}"B2 zB z4 | "${V}"B2 zB z4 |]`,
    },
    {name: 'Whole notes', abc: `${rhythm}"${I}"B8 | "${IV}"B8 |]`},
    {
      name: 'A melody line',
      abc: `K:${k}\n"${I}"${n(0)}2 ${n(1)}${n(2)} ${n(3)}2 ${n(2)}${n(1)} | "${V}"${n(0)}8 |]`,
    },
  ]
}

/**
 * Which tab a lick reads best as: a "% instrument: bass" line in the ABC
 * (ABC comments are ignored by the renderer) asks for 4-string bass tab;
 * anything else gets guitar tab.
 */
export function abcTabInstrument(abc: string): 'guitar' | 'bass' {
  return /^%\s*instrument:\s*bass\b/im.test(abc) ? 'bass' : 'guitar'
}
