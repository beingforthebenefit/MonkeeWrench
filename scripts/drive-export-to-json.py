"""Turn a Google Drive export of the band's old setup into import JSON.

Usage:
  python3 -I scripts/drive-export-to-json.py "<Original Documents dir>" "<Monkee Business.xlsx>" data/import.json

Reads the chart .docx files (Drive's Download of the "Original Documents"
folder) and the "Songs" tab of the spreadsheet (File > Download > .xlsx).
Writes {songs, proposals, availability} for `make import` and
`scripts/import-members.ts`. Standard library
only. The output contains copyrighted lyrics: keep it in data/ (gitignored).
"""
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
S = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
R = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
PR = '{http://schemas.openxmlformats.org/package/2006/relationships}'


def docx_text(path):
    with zipfile.ZipFile(path) as z:
        root = ET.fromstring(z.read('word/document.xml'))
    lines = []
    for p in root.iter(W + 'p'):
        buf = []
        for el in p.iter():
            if el.tag == W + 't':
                buf.append(el.text or '')
            elif el.tag == W + 'tab':
                buf.append('\t')
            elif el.tag in (W + 'br', W + 'cr'):
                buf.append('\n')
        lines.append(''.join(buf))
    return '\n'.join(lines)


def col_index(ref):
    letters = re.match(r'[A-Z]+', ref).group(0)
    n = 0
    for ch in letters:
        n = n * 26 + ord(ch) - 64
    return n - 1


def xlsx_rows(path):
    with zipfile.ZipFile(path) as z:
        names = z.namelist()
        shared = []
        if 'xl/sharedStrings.xml' in names:
            for si in ET.fromstring(z.read('xl/sharedStrings.xml')).iter(S + 'si'):
                shared.append(''.join(t.text or '' for t in si.iter(S + 't')))
        styles = ET.fromstring(z.read('xl/styles.xml'))
        fills = []
        for f in styles.find(S + 'fills'):
            fg = f.find(f'{S}patternFill/{S}fgColor')
            fills.append(fg.get('rgb') if fg is not None else None)
        xfs = [int(x.get('fillId', 0)) for x in styles.find(S + 'cellXfs')]
        wb = ET.fromstring(z.read('xl/workbook.xml'))
        sheets = [(s.get('name'), s.get(R + 'id')) for s in wb.iter(S + 'sheet')]
        wbrels = {r.get('Id'): r.get('Target') for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
        out = {}
        for name, rid in sheets:
            target = wbrels[rid].lstrip('/')
            target = target if target.startswith('xl/') else 'xl/' + target
            sheet = ET.fromstring(z.read(target))
            rels_path = target.replace('worksheets/', 'worksheets/_rels/') + '.rels'
            links = {}
            if rels_path in names:
                rels = {r.get('Id'): r.get('Target') for r in ET.fromstring(z.read(rels_path))}
                for h in sheet.iter(S + 'hyperlink'):
                    if h.get(R + 'id') in rels:
                        links[h.get('ref')] = rels[h.get(R + 'id')]
            rows = []
            for row in sheet.iter(S + 'row'):
                cells = {}
                for c in row.iter(S + 'c'):
                    ref = c.get('r')
                    v = c.find(S + 'v')
                    t = c.get('t')
                    if t == 's' and v is not None:
                        val = shared[int(v.text)]
                    elif t == 'inlineStr':
                        val = ''.join(x.text or '' for x in c.iter(S + 't'))
                    else:
                        val = v.text if v is not None else ''
                    fill = fills[xfs[int(c.get('s', 0))]] if c.get('s') else None
                    cells[col_index(ref)] = {'v': val, 'fill': fill, 'link': links.get(ref)}
                rows.append({'r': int(row.get('r')), 'cells': cells})
            out[name] = rows
        return out


GREEN = 'FF00FF00'
# The availability tab has no year on it
YEAR = 2026
# Fix obvious typos in the sheet's titles
TITLE_FIXES = {"Tommorow's Gonna Be Another Day": "Tomorrow's Gonna Be Another Day"}


def norm(s):
    s = s.replace('\u2019', "'").replace('_', "'")
    s = re.sub(r'\.pdf$', '', s.strip(), flags=re.I)
    return re.sub(r'[^a-z0-9]', '', s.lower())


def clean_chart(text, *titles):
    lines = [l.replace('\u00a0', ' ').rstrip() for l in text.split('\n')]
    # The Doc's first line repeats the song's name as a heading -- sometimes
    # the sheet's title, sometimes the Doc's own ("Steppin'" vs "Stepping")
    while lines and not lines[0].strip():
        lines.pop(0)
    if lines and norm(lines[0]) in {norm(t) for t in titles if t}:
        lines.pop(0)
    return '\n'.join(lines).strip('\n') + '\n'


def songs_from_sheet(rows, charts):
    by_norm = {}
    for stem, text in charts.items():
        # Two copies of one song: keep the straight-quote one (the newer)
        by_norm.setdefault(norm(stem), (stem, text))
        if '\u2019' not in stem:
            by_norm[norm(stem)] = (stem, text)
    songs, proposals, used = [], [], set()
    header_seen = in_proposals = False
    for row in rows:
        c = row['cells']
        first = c.get(0, {}).get('v', '').strip()
        if not header_seen:
            header_seen = first == 'Song'
            continue
        if first.lower().startswith('possible'):
            in_proposals = True
            continue
        if not first:
            continue
        if in_proposals:
            m = re.match(r'^(.*?)\s*\((.*)\)\s*$', first)
            proposals.append({'title': m.group(1) if m else first, 'artist': m.group(2) if m else ''})
            continue
        get = lambda i: (c.get(i) or {}).get('v', '').strip()
        link = lambda i: (c.get(i) or {}).get('link')
        chart_name = get(2)
        match = by_norm.get(norm(chart_name)) if chart_name else None
        match = match or by_norm.get(norm(first))
        if match:
            used.add(match[0])
        title = TITLE_FIXES.get(first, first)
        guitars = get(6)
        songs.append({
            'title': title,
            'writer': get(4) or None,
            'leadSinger': get(5) or None,
            'guitars': int(float(guitars)) if guitars else None,
            'keys': get(7) or None,
            'percussion': get(8) or None,
            'youtubeUrl': link(1),
            'lyricsUrl': link(3),
            'status': 'READY' if (c.get(0) or {}).get('fill') == GREEN else 'LEARNING',
            'chartFile': match[0] if match else None,
            'chartText': clean_chart(match[1], title, match[0]) if match else None,
        })
    unused = sorted(set(charts) - used)
    return songs, proposals, unused


MONTHS = {m: i for i, m in enumerate(
    ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'], 1)}
DOW = ['M', 'T', 'W', 'Th', 'F', 'Sa', 'Su']
MARKS = {'X': 'OUT', 'A': 'PM_OUT'}


def availability_from_sheet(rows, year):
    """The availability tab: a header row of names, "Sept:"/"Oct:" marker rows,
    then one row per day. X = out all day/evening, A = out in the afternoon."""
    import datetime as dt
    names, month, out, answered = {}, None, [], set()
    for row in rows:
        c = row['cells']
        get = lambda i: (c.get(i) or {}).get('v', '').strip()
        first = get(0)
        m = re.match(r'^([A-Za-z]{3})[a-z]*\.?:?$', first)
        if m and m.group(1).lower() in MONTHS:
            month = MONTHS[m.group(1).lower()]
            if not names:  # the first marker row also carries the names
                names = {i: get(i) for i in sorted(c) if i >= 2 and get(i)}
            continue
        if not month or not re.match(r'^\d+(\.0)?$', first):
            continue
        day = dt.date(year, month, int(float(first)))
        if get(1) and DOW[day.weekday()] != get(1):
            raise SystemExit(f'weekday mismatch on {day}: sheet says {get(1)}')
        for i, name in names.items():
            v = get(i).upper()
            if not v:
                continue
            if v not in MARKS:
                raise SystemExit(f'unknown mark {v!r} for {name} on {day}')
            out.append({'name': name, 'date': day.isoformat(), 'kind': MARKS[v]})
            answered.add(name)
    return {'members': list(names.values()), 'answered': sorted(answered), 'entries': out}


def main():
    docs_dir, xlsx, out = sys.argv[1:4]
    charts = {}
    for f in sorted(Path(docs_dir).glob('*.docx')):
        charts[f.stem] = docx_text(f)
    sheets = xlsx_rows(xlsx)
    songs, proposals, unused = songs_from_sheet(sheets['Songs'], charts)
    avail_tab = next((k for k in sheets if 'availab' in k.lower()), None)
    availability = availability_from_sheet(sheets[avail_tab], YEAR) if avail_tab else None
    Path(out).write_text(json.dumps(
        {'songs': songs, 'proposals': proposals, 'availability': availability},
        indent=1, ensure_ascii=False))
    if availability:
        print(f"availability: {len(availability['entries'])} marks for "
              f"{', '.join(availability['members'])}; no marks at all: "
              f"{', '.join(sorted(set(availability['members']) - set(availability['answered']))) or 'none'}")
    with_chart = sum(1 for s in songs if s['chartText'])
    print(f'{len(songs)} songs ({with_chart} with charts), {len(proposals)} proposals')
    for s in songs:
        if not s['chartText']:
            print('  no chart:', s['title'])
    for u in unused:
        print('  chart not in sheet:', u)


main()
