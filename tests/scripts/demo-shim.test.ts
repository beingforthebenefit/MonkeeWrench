import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {beforeEach, describe, expect, it, vi} from 'vitest'

const SHIM = readFileSync(join(__dirname, '../../scripts/demo/demo.js'), 'utf8')

// The page's own fetch, as the shim finds it
const real = vi.fn(
  async (_input: RequestInfo | URL, _init?: RequestInit) =>
    new Response('real'),
)

function load(path = '/songs') {
  window.history.replaceState(null, '', path)
  window.fetch = real as unknown as typeof fetch
  document.body.innerHTML = ''
  new Function(SHIM)()
}

describe('the public demo shim (scripts/demo/demo.js)', () => {
  beforeEach(() => real.mockClear())

  it('refuses every change and says so', async () => {
    load()
    const r = await fetch('/api/songs/s1/chart', {method: 'POST', body: '{}'})
    expect(r.status).toBe(403)
    expect((await r.json()).error).toMatch(/demo/)
    expect(real).not.toHaveBeenCalled()
    expect(document.querySelector('[role=status]')?.textContent).toMatch(
      /nothing you change is saved/,
    )
  })

  it('finishes the tour quietly', async () => {
    load()
    const r = await fetch('/api/account/settings', {
      method: 'PATCH',
      body: JSON.stringify({tourDone: true}),
    })
    expect(r.ok).toBe(true)
    expect(document.querySelector('[role=status]')).toBeNull()
  })

  it('reads captured files, PDFs and calendar files by their saved names', async () => {
    load()
    await fetch('/api/auth/session')
    await fetch('/api/songs/s1/pdf?download=1&paper=a4')
    expect(real.mock.calls.map((c) => c[0])).toEqual([
      '/api/auth/session',
      '/api/songs/s1/pdf.pdf',
    ])
  })

  it('drops the trailing slash a static host redirects to', () => {
    load('/songs/abc/?tour')
    expect(window.location.pathname).toBe('/songs/abc')
    expect(window.location.search).toBe('?tour')
  })

  it('leaves live updates nothing to retry', () => {
    load()
    const es = new EventSource('/api/stream')
    expect(es.readyState).toBe(2)
  })
})
