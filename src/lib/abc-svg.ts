import {Worker} from 'worker_threads'

/**
 * ABC notation → SVG on the server, for PDFs. abcjs draws into a DOM, so it
 * runs against jsdom — in a short-lived worker thread, because jsdom's
 * `window`/`document` globals must never leak into the server itself (code
 * would start thinking it runs in a browser).
 */

export type AbcJob = {abc: string; steps: number}

const WORKER = `
const {parentPort, workerData} = require('worker_threads')
const {JSDOM} = require('jsdom')
const dom = new JSDOM('<!doctype html><body></body>', {pretendToBeVisual: true})
global.window = dom.window
global.document = dom.window.document
global.navigator = dom.window.navigator
const ABCJS = require('abcjs')
parentPort.postMessage(
  workerData.map(({abc, steps}) => {
    try {
      const el = document.createElement('div')
      document.body.appendChild(el)
      ABCJS.renderAbc(el, abc, {
        visualTranspose: steps,
        foregroundColor: '#000',
        staffwidth: 420,
        paddingtop: 0, paddingbottom: 0, paddingleft: 0, paddingright: 0,
      })
      const svg = el.querySelector('svg')
      if (!svg) return null
      // svg-to-pdfkit wants plain markup: drop abcjs's embedded <style>
      svg.querySelectorAll('style').forEach((s) => s.remove())
      return {
        svg: svg.outerHTML,
        width: parseFloat(svg.getAttribute('width')) || 420,
        height: parseFloat(svg.getAttribute('height')) || 100,
      }
    } catch (e) {
      return null
    }
  }),
)
`

export type AbcSvg = {svg: string; width: number; height: number}

/** One SVG per job, in order; null where the notation couldn't be drawn. */
export function renderAbcSvgs(
  jobs: AbcJob[],
  timeoutMs = 15_000,
): Promise<(AbcSvg | null)[]> {
  if (!jobs.length) return Promise.resolve([])
  return new Promise((resolve) => {
    const none = () => jobs.map(() => null)
    let w: Worker
    try {
      w = new Worker(WORKER, {eval: true, workerData: jobs})
    } catch {
      return resolve(none())
    }
    const timer = setTimeout(() => {
      w.terminate()
      resolve(none())
    }, timeoutMs)
    w.once('message', (out) => {
      clearTimeout(timer)
      resolve(out)
      w.terminate()
    })
    w.once('error', () => {
      clearTimeout(timer)
      resolve(none())
    })
  })
}
