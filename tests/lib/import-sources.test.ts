// @vitest-environment node
import {describe, expect, it} from 'vitest'
import {strToU8, zipSync} from 'fflate'
import path from 'path'
import initSqlJs from 'sql.js/dist/sql-wasm.js'
import {
  cleanByline,
  fromChordPro,
  fromOnSongText,
  readFiles,
  titleFromFile,
} from '@/lib/import/sources'
import {docxText} from '@/lib/import/docx'

const sqlite = initSqlJs({
  locateFile: () =>
    path.resolve(__dirname, '../../node_modules/sql.js/dist/sql-wasm.wasm'),
})
const open = async (b: Uint8Array) => new (await sqlite).Database(b)
const file = (name: string, text: string) => ({name, bytes: strToU8(text)})

function docx(paragraphs: string[]) {
  const body = paragraphs
    .map(
      (p) =>
        `<w:p><w:r>${p
          .split('\t')
          .map(
            (t) =>
              `<w:t xml:space="preserve">${t.replace(/&/g, '&amp;')}</w:t>`,
          )
          .join('<w:tab/>')}</w:r></w:p>`,
    )
    .join('')
  return zipSync({
    'word/document.xml': strToU8(
      `<?xml version="1.0"?><w:document xmlns:w="x"><w:body>${body}</w:body></w:document>`,
    ),
  })
}

describe('file names and bylines', () => {
  it('undoes Drive’s underscores for apostrophes', () => {
    expect(titleFromFile('Charts/Don_t Call On Me.docx')).toBe(
      "Don't Call On Me",
    )
    expect(titleFromFile('For Pete_s Sake.docx')).toBe("For Pete's Sake")
    expect(titleFromFile('my_song_file.txt')).toBe('my song file')
  })
  it('keeps artists and drops chart lines posing as one', () => {
    expect(cleanByline('Blind Melon | E-Chords')).toBe('Blind Melon')
    expect(cleanByline('Louis Armstrong')).toBe('Louis Armstrong')
    for (const bad of [
      'Intro: C Am F G',
      'Capo 3',
      'D',
      'E A  D9 AM7',
      '[Intro]',
      'key of G',
      'e|----|',
      '',
    ])
      expect(cleanByline(bad)).toBeNull()
  })
})

describe('ChordPro and text files', () => {
  it('takes a ChordPro file’s title and artist', () => {
    const f = fromChordPro(
      'x.cho',
      '{title: Sway}\n{artist: Dean Martin}\n[C]la la',
    )
    expect(f.title).toBe('Sway')
    expect(f.song.writer).toBe('Dean Martin')
    expect(f.song.chart).toEqual({chordpro: expect.stringContaining('la la')})
  })
  it('falls back to the file name', () => {
    expect(fromChordPro('Lowdown.pro', '[C]words').title).toBe('Lowdown')
  })
  it('reads an OnSong file: title, artist, key', () => {
    const f = fromOnSongText(
      'a.onsong',
      'Proud Mary\nCreedence Clearwater Revival\nKey: D\n\nD\nfirst line here',
    )
    expect(f.title).toBe('Proud Mary')
    expect(f.song.writer).toBe('Creedence Clearwater Revival')
    expect(f.song.chart).toMatchObject({
      onsong: {key: 'D', title: 'Proud Mary'},
    })
  })
  it('doesn’t take a chord row for the artist', () => {
    expect(
      fromOnSongText('a.txt', 'Song\nG  C  D\nwords').song.writer,
    ).toBeNull()
  })
})

describe('Word files', () => {
  it('keeps one line a paragraph, tabs and entities', () => {
    expect(docxText(docx(['G\tC', 'Rock & roll']))).toBe('G\tC\nRock & roll')
  })
  it('a Drive zip of Docs: titled by file, the title line dropped', async () => {
    const zip = zipSync({
      'Charts/Daydream Believer.docx': docx([
        'Daydream Believer',
        '',
        'G   Am',
        'la la la la',
      ]),
      'Charts/notes.pdf': strToU8('%PDF'),
      '__MACOSX/._junk': strToU8('x'),
    })
    const f = await readFiles([{name: 'drive.zip', bytes: zip}], open)
    expect(f.songs.map((s) => s.title)).toEqual(['Daydream Believer'])
    expect(f.songs[0].song.chart).toEqual({text: 'G   Am\nla la la la'})
    expect(f.skipped).toEqual([
      {name: 'notes.pdf', why: expect.stringMatching(/PDF/)},
    ])
  })
})

describe('other files', () => {
  it('a CSV of songs comes in without charts', async () => {
    const f = await readFiles(
      [
        file(
          'songs.csv',
          'Song,Artist,Length,Ready\n"Proud Mary",CCR,3:10,yes\nSway,,,no\n',
        ),
      ],
      open,
    )
    expect(f.songs.map((s) => s.song)).toEqual([
      expect.objectContaining({
        title: 'Proud Mary',
        writer: 'CCR',
        seconds: 190,
        status: 'READY',
        chart: null,
      }),
      expect.objectContaining({title: 'Sway', status: 'LEARNING', chart: null}),
    ])
  })
  it('a Bandstand export: songs, setlists that choose their songs', async () => {
    const f = await readFiles(
      [
        file(
          'band.bandstand.json',
          JSON.stringify({
            format: 'bandstand',
            songs: [{title: 'Sway', chart: {chordpro: '[C]x'}}],
            setlists: [{name: 'Gig', items: [{song: 'Sway'}, {break: 15}]}],
            rehearsals: [{date: '2026-10-12'}],
          }),
        ),
      ],
      open,
    )
    expect(f.songs).toHaveLength(1)
    expect(f.sets[0].songIds).toEqual([f.songs[0].id])
    expect(f.rehearsals).toEqual([{date: '2026-10-12'}])
  })
  it('says why it leaves a file out', async () => {
    const f = await readFiles(
      [file('x.json', '{"nope":1}'), file('a.mp3', '')],
      open,
    )
    expect(f.skipped.map((s) => s.why)).toEqual([
      'Not a Bandstand export',
      'A recording, not a chart',
    ])
  })
})

describe('an OnSong backup', () => {
  async function backup() {
    const db = new (await sqlite).Database()
    db.run(`
      CREATE TABLE Song (ID varchar, title varchar, sortTitle varchar, byline varchar, content varchar, "key" varchar, duration integer, deleted boolean);
      CREATE TABLE SongSet (ID varchar, title varchar, datetime date, created date);
      CREATE TABLE SongSetItem (setID varchar, songID varchar, orderIndex integer, transposedKey varchar);
      CREATE TABLE OSBook (ID varchar, name varchar, deleted integer);
      CREATE TABLE OSBookSong (bookID varchar, songID varchar, orderIndex integer);
      INSERT INTO Song VALUES ('s1','Sway',NULL,'Dean Martin','Sway\nKey: C\n\n[C]words','C',180,0),
        ('s2','Proud Mary',NULL,'intro','Proud Mary\n\nD\nFirst','D',NULL,0),
        ('s3','Gone',NULL,NULL,'Gone\nwords',NULL,NULL,1);
      INSERT INTO SongSet VALUES ('old','Old gig',1400000000,1400000000),('new','Farmers market',1780000000,1780000000),('empty','Nothing',1790000000,1790000000);
      INSERT INTO SongSetItem VALUES ('new','s2',0,'E'),('new','s1',1,NULL),('new','s3',2,NULL),('old','s1',0,NULL);
      INSERT INTO OSBook VALUES ('b1','Elmwoods',0);
      INSERT INTO OSBookSong VALUES ('b1','s1',0);
    `)
    return zipSync({
      'OnSong.sqlite3': db.export(),
      'Sway.onsong': strToU8('loose copy'),
    })
  }

  it('reads its library: songs, sets newest first in order with keys, books', async () => {
    const f = await readFiles(
      [{name: 'OnSong 2026.backup', bytes: await backup()}],
      open,
    )
    expect(f.library).toBe(true)
    // Deleted songs stay out; loose song files beside the library are ignored
    expect(f.songs.map((s) => s.title)).toEqual(['Proud Mary', 'Sway'])
    const sway = f.songs.find((s) => s.title === 'Sway')!
    expect(sway.song).toMatchObject({writer: 'Dean Martin', seconds: 180})
    expect(
      f.songs.find((s) => s.title === 'Proud Mary')!.song.writer,
    ).toBeNull()
    expect(f.sets.map((s) => s.setlist.name)).toEqual([
      'Farmers market',
      'Old gig',
    ])
    expect(f.sets[0].setlist.items).toEqual([
      {song: 'Proud Mary', key: 'E'},
      {song: 'Sway', key: null},
    ])
    expect(f.sets[0].songIds).toEqual(['os:s2', 'os:s1'])
    expect(f.books).toEqual([
      {id: 'os:b1', name: 'Elmwoods', songIds: ['os:s1']},
    ])
  })

  it('a database that isn’t OnSong’s is left out', async () => {
    const db = new (await sqlite).Database()
    db.run('CREATE TABLE t (x int)')
    const f = await readFiles([{name: 'x.sqlite3', bytes: db.export()}], open)
    expect(f.skipped).toEqual([
      {name: 'x.sqlite3', why: 'Not an OnSong library'},
    ])
  })
})
