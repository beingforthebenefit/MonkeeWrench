export const dynamic = 'force-dynamic'

import {readFile} from 'fs/promises'
import path from 'path'

/**
 * SQLite for the browser (sql.js), so the Import page can read an OnSong
 * backup on the device: the library never leaves it, only the songs chosen.
 * Served from the package rather than a CDN, so a self-hosted install needs
 * nothing from outside.
 */
export async function GET() {
  const wasm = await readFile(
    path.join(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm'),
  )
  return new Response(new Uint8Array(wasm), {
    headers: {
      'Content-Type': 'application/wasm',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
