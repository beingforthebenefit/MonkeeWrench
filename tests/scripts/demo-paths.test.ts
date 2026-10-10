import {describe, expect, it} from 'vitest'
import * as paths from '../../scripts/demo/paths.mjs'

const {apiFile, pageFiles, pageLinks, resourceLinks, skipPage} = paths

describe('demo capture paths', () => {
  it('writes each page both ways GitHub Pages may look for it', () => {
    expect(pageFiles('/songs')).toEqual(['songs.html', 'songs/index.html'])
    expect(pageFiles('/songs/abc/edit')).toEqual([
      'songs/abc/edit.html',
      'songs/abc/edit/index.html',
    ])
  })

  it('follows page links, without queries, and not into the API or sign-in', () => {
    const html = `
      <a href="/songs/abc">x</a> <a href="/songs/abc/history?v=2">x</a>
      <a href="/setlists/">x</a> <a href="/api/songs/abc/pdf">x</a>
      <a href="/login">x</a> <a href="/bands/switch?b=1">x</a>
      <a href="/">x</a> <a href="https://example.com/x">x</a>
      <link href="/_next/static/a.css"> <a href="/help/shot.webp">x</a>`
    expect([...pageLinks(html)].sort()).toEqual([
      '/setlists',
      '/songs/abc',
      '/songs/abc/history',
    ])
  })

  it('skips pages with nothing to show from a static copy', () => {
    expect(skipPage('/')).toBe(true)
    expect(skipPage('/login')).toBe(true)
    expect(skipPage('/favicon.ico')).toBe(true)
    expect(skipPage('/help')).toBe(false)
    expect(skipPage('/tour/song')).toBe(false)
  })

  it('collects files from attributes and from the page data', () => {
    const html = `<img src="/api/avatars/u1">
      self.__next_f.push([1,"{\\"src\\":\\"/api/cues/c1/image\\"}"])
      <a href="/api/rehearsals/r1/ics">ics</a>
      <a href="/api/songs/s1/pdf?download=1">pdf</a>
      fetch("/api/stream") fetch("/api/auth/session")`
    expect([...resourceLinks(html)].sort()).toEqual([
      '/api/avatars/u1',
      '/api/cues/c1/image',
      '/api/rehearsals/r1/ics',
      '/api/songs/s1/pdf',
      '/favicon.ico',
      '/manifest.webmanifest',
    ])
  })

  it('gives PDFs and calendar files their extension, and nothing else', () => {
    expect(apiFile('/api/songs/s1/pdf')).toBe('api/songs/s1/pdf.pdf')
    expect(apiFile('/api/rehearsals/r1/ics')).toBe('api/rehearsals/r1/ics.ics')
    expect(apiFile('/api/export')).toBe('api/export.json')
    expect(apiFile('/api/avatars/u1')).toBe('api/avatars/u1')
    expect(apiFile('/favicon.ico')).toBe('favicon.ico')
  })
})
