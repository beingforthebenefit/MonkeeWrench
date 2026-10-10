import React from 'react'
import {beforeEach, describe, expect, it} from 'vitest'
import {render, screen, within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Importer from '@/components/import/Importer'
import {mockFetch} from '../fetch-mock'

const summary = (o: any = {}) => ({
  songsAdded: 0,
  songsThere: 0,
  cues: 0,
  setlistsAdded: 0,
  setlistsThere: 0,
  rehearsalsAdded: 0,
  missing: [],
  ...o,
})
const file = (name: string, text: string) => new File([text], name)

// jsdom's File has no arrayBuffer() (browsers' does)
if (!File.prototype.arrayBuffer)
  File.prototype.arrayBuffer = function (this: File) {
    return new Promise<ArrayBuffer>((resolve) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result as ArrayBuffer)
      r.readAsArrayBuffer(this)
    })
  }
const input = () => screen.getByLabelText('Files to import')

describe('Importer', () => {
  beforeEach(() => {
    mockFetch({'POST /api/import': {body: summary({songsAdded: 2})}})
  })

  it('explains where files come from until something is dropped', () => {
    render(<Importer existing={[]} />)
    expect(screen.getByText('Google Docs')).toBeInTheDocument()
    expect(screen.getByText('A spreadsheet of songs')).toBeInTheDocument()
  })

  it('reads files, chooses the new ones, and imports them', async () => {
    const {calls} = mockFetch({
      'POST /api/import': {
        body: summary({songsAdded: 1, songsThere: 1, cues: 1}),
      },
    })
    render(<Importer existing={['Sway']} />)
    // As a drop would: the file picker's accept list doesn't apply
    await userEvent
      .setup({applyAccept: false})
      .upload(input(), [
        file('sway.cho', '{title: Sway}\n[C]la la'),
        file('Proud Mary.onsong', 'Proud Mary\nCCR\nKey: D\n\nD\nfirst line'),
        file('chart.pdf', '%PDF'),
      ])
    expect(await screen.findByText(/Songs · 1 of 2 chosen/)).toBeInTheDocument()
    expect(screen.getByText('1 file left out')).toBeInTheDocument()
    // Sway is already in the band: not chosen
    expect(screen.getByLabelText('Import Sway')).not.toBeChecked()
    await userEvent.click(screen.getByLabelText('Import Sway'))
    expect(
      screen.getByText(/already in the band: left as it is/),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', {name: 'Import 2 songs'}))
    expect(await screen.findByText('Imported')).toBeInTheDocument()
    expect(calls[0].body.songs.map((s: any) => s.title)).toEqual([
      'Sway',
      'Proud Mary',
    ])
    expect(
      screen.getByText(
        '1 song added (1 already in the band, left as they were)',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText(/1 of your own notes/)).toBeInTheDocument()
  })

  it('renames a song before it comes in', async () => {
    const {calls} = mockFetch({
      'POST /api/import': {body: summary({songsAdded: 1})},
    })
    render(<Importer existing={[]} />)
    await userEvent.upload(input(), file('x.cho', '{title: proud mary}\n[D]x'))
    const title = await screen.findByDisplayValue('proud mary')
    await userEvent.clear(title)
    await userEvent.type(title, 'Proud Mary')
    await userEvent.click(screen.getByRole('button', {name: 'Import 1 song'}))
    await screen.findByText('Imported')
    expect(calls[0].body.songs[0].title).toBe('Proud Mary')
  })

  it('finds, chooses and clears songs; flags a second song with the same title', async () => {
    render(<Importer existing={[]} />)
    await userEvent.upload(input(), [
      file('a.cho', '{title: Alpha}\n{artist: Ann}\n[C]x'),
      file('b.cho', '{title: Beta}\n[C]x'),
      file('b2.cho', '{title: beta}\n[C]y'),
    ])
    expect(
      await screen.findByText(/same title as another chosen song/),
    ).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Find a song'), 'ann')
    expect(screen.getAllByRole('checkbox', {name: /^Import/})).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', {name: 'Clear these'}))
    await userEvent.clear(screen.getByLabelText('Find a song'))
    expect(screen.getByText(/Songs · 2 of 3 chosen/)).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText('Chosen only'))
    expect(screen.getAllByRole('checkbox', {name: /^Import/})).toHaveLength(2)
    await userEvent.click(screen.getByLabelText('Chosen only'))
    await userEvent.click(screen.getByRole('button', {name: 'Clear all'}))
    expect(screen.getByRole('button', {name: 'Import 0 songs'})).toBeDisabled()
    await userEvent.click(screen.getByRole('button', {name: 'Choose all'}))
    expect(screen.getByText(/Songs · 3 of 3 chosen/)).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Find a song'), 'zzz')
    expect(screen.getByText('No song matches.')).toBeInTheDocument()
  })

  it('a Bandstand export brings its setlists, chosen; the setlist goes in the last batch', async () => {
    const {calls} = mockFetch({
      'POST /api/import': {
        body: summary({
          songsAdded: 1,
          setlistsAdded: 1,
          rehearsalsAdded: 1,
          missing: ['Free Bird'],
        }),
      },
    })
    render(<Importer existing={[]} />)
    await userEvent.upload(
      input(),
      file(
        'band.bandstand.json',
        JSON.stringify({
          songs: [{title: 'Sway', chart: {chordpro: '[C]x'}}],
          setlists: [
            {
              name: 'Gig',
              gigDate: '2026-11-01',
              items: [{song: 'Sway'}, {song: 'Free Bird'}],
            },
          ],
          rehearsals: [{date: '2026-10-12'}],
        }),
      ),
    )
    expect(await screen.findByText('Gig')).toBeInTheDocument()
    expect(screen.getByText('2 songs · 2026-11-01')).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', {name: 'Import 1 song and 1 setlist'}),
    )
    await screen.findByText('Imported')
    expect(calls[0].body.setlists[0].name).toBe('Gig')
    expect(calls[0].body.rehearsals).toEqual([{date: '2026-10-12'}])
    expect(
      screen.getByText(/Left out of setlists, not in the band: Free Bird/),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {name: 'See the setlists'}),
    ).toHaveAttribute('href', '/setlists')
  })

  it('a pasted setlist: matches songs, offers to add unknown ones', async () => {
    const {calls} = mockFetch({
      'POST /api/import': {body: summary({songsAdded: 1, setlistsAdded: 1})},
    })
    render(<Importer existing={['Mustang Sally']} />)
    await userEvent.click(screen.getByRole('button', {name: 'Paste a setlist'}))
    await userEvent.type(screen.getByLabelText('Setlist name'), 'Riverside')
    await userEvent.type(
      screen.getByLabelText('The setlist'),
      'Set 1{enter}mustang sally [[G]{enter}Brand New Song',
    )
    await userEvent.click(screen.getByRole('button', {name: 'Check and add'}))
    expect(screen.getByText('Brand New Song')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', {name: 'Add the setlist'}))
    expect(screen.getByText('Riverside')).toBeInTheDocument()
    expect(screen.getByText(/Pasted setlist · no chart/)).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', {name: 'Import 1 song and 1 setlist'}),
    )
    await screen.findByText('Imported')
    expect(calls[0].body.songs).toEqual([
      {title: 'Brand New Song', chart: null},
    ])
    expect(calls[0].body.setlists[0].items).toEqual([
      {set: 'Set 1', minutes: null},
      {song: 'Mustang Sally', key: 'G'},
      {song: 'Brand New Song', key: null},
    ])
  })

  it('a pasted setlist can leave unknown songs out, or be closed', async () => {
    render(<Importer existing={['Sway']} />)
    await userEvent.click(screen.getByRole('button', {name: 'Paste a setlist'}))
    await userEvent.type(
      screen.getByLabelText('The setlist'),
      'Sway{enter}Nope',
    )
    await userEvent.click(screen.getByRole('button', {name: 'Check and add'}))
    await userEvent.click(
      screen.getByLabelText('Add them as songs without charts'),
    )
    await userEvent.click(screen.getByRole('button', {name: 'Add the setlist'}))
    expect(screen.getByText('Pasted setlist')).toBeInTheDocument()
    expect(
      screen.getByRole('button', {name: 'Import 0 songs and 1 setlist'}),
    ).toBeEnabled()
    await userEvent.click(screen.getByRole('button', {name: 'Paste a setlist'}))
    await userEvent.click(screen.getByRole('button', {name: 'Close'}))
    expect(screen.queryByLabelText('The setlist')).not.toBeInTheDocument()
  })

  it('sends a hundred songs at a time and says where it stopped', async () => {
    let n = 0
    const {calls} = mockFetch({
      'POST /api/import': () =>
        ++n === 2
          ? {status: 500, body: {error: 'Server fell over.'}}
          : {body: summary({songsAdded: 100})},
    })
    render(<Importer existing={[]} />)
    const files = Array.from({length: 150}, (_, i) =>
      file(`s${i}.cho`, `{title: Song ${i}}\n[C]x`),
    )
    await userEvent.upload(input(), files)
    await userEvent.click(
      await screen.findByRole('button', {name: 'Import 150 songs'}),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Server fell over. The first 100 songs are in; importing again adds the rest without doubling any.',
    )
    expect(calls.map((c) => c.body.songs.length)).toEqual([100, 50])
    // A hundred and fifty rows fit; no "search to find them" yet
    expect(screen.queryByText(/search to find them/)).not.toBeInTheDocument()
  })

  it('takes dropped files', async () => {
    render(<Importer existing={[]} />)
    const zone = screen.getByText('Drop files here').parentElement!
    const dataTransfer = {files: [file('a.cho', '{title: Dropped}\n[C]x')]}
    const {fireEvent} = await import('@testing-library/react')
    fireEvent.dragOver(zone, {dataTransfer})
    fireEvent.dragLeave(zone)
    fireEvent.drop(zone, {dataTransfer})
    expect(await screen.findByDisplayValue('Dropped')).toBeInTheDocument()
    expect(
      within(zone.parentElement!).getByText('Add more files'),
    ).toBeInTheDocument()
  })
})
