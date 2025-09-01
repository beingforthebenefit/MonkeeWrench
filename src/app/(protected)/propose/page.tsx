'use client'
import {useMemo, useState} from 'react'
import {TextField, Button, Stack, Alert, FormHelperText} from '@mui/material'
import {isHttpUrl, httpUrlError, suggestHttpUrls} from '@/lib/url'

export default function Propose() {
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('The Monkees')
  const [chartUrl, setChartUrl] = useState('')
  const [lyricsUrl, setLyricsUrl] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // If any link is non-empty, it must be a valid http(s) URL
  const chartInvalid = useMemo(
    () => chartUrl.trim() !== '' && !isHttpUrl(chartUrl.trim()),
    [chartUrl],
  )
  const chartSuggestions = useMemo(
    () => (chartInvalid ? suggestHttpUrls(chartUrl) : []),
    [chartInvalid, chartUrl],
  )
  const lyricsInvalid = useMemo(
    () => lyricsUrl.trim() !== '' && !isHttpUrl(lyricsUrl.trim()),
    [lyricsUrl],
  )
  const lyricsSuggestions = useMemo(
    () => (lyricsInvalid ? suggestHttpUrls(lyricsUrl) : []),
    [lyricsInvalid, lyricsUrl],
  )
  const youtubeInvalid = useMemo(
    () => youtubeUrl.trim() !== '' && !isHttpUrl(youtubeUrl.trim()),
    [youtubeUrl],
  )
  const youtubeSuggestions = useMemo(
    () => (youtubeInvalid ? suggestHttpUrls(youtubeUrl) : []),
    [youtubeInvalid, youtubeUrl],
  )

  const formInvalid =
    !title.trim() ||
    !artist.trim() ||
    chartInvalid ||
    lyricsInvalid ||
    youtubeInvalid

  async function submit() {
    if (formInvalid) return
    setMsg(null)
    setBusy(true)
    try {
      const res = await fetch('/api/proposals', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          title: title.trim(),
          artist: artist.trim(),
          chartUrl: chartUrl.trim() || undefined,
          lyricsUrl: lyricsUrl.trim() || undefined,
          youtubeUrl: youtubeUrl.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const t = await res.text().catch(() => '')
        throw new Error(t || `Error: ${res.status}`)
      }
      setMsg('Submitted')
      setTitle('')
      setArtist('The Monkees')
      setChartUrl('')
      setLyricsUrl('')
      setYoutubeUrl('')
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error'
      setMsg(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Stack spacing={2}>
      <TextField
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        fullWidth
        required
      />
      <TextField
        label="Artist"
        value={artist}
        onChange={(e) => setArtist(e.target.value)}
        fullWidth
        required
      />

      <TextField
        label="Chart URL"
        value={chartUrl}
        onChange={(e) => setChartUrl(e.target.value)}
        fullWidth
        error={chartInvalid}
      />
      {chartInvalid && (
        <>
          <FormHelperText error>
            {httpUrlError(chartUrl) || 'Must be a valid http(s) URL'}
          </FormHelperText>
          {chartSuggestions.length > 0 && (
            <Stack direction="row" spacing={1}>
              {chartSuggestions.map((s) => (
                <Button key={s} size="small" variant="text" onClick={() => setChartUrl(s)}>
                  Use {s}
                </Button>
              ))}
            </Stack>
          )}
        </>
      )}

      <TextField
        label="Lyrics URL"
        value={lyricsUrl}
        onChange={(e) => setLyricsUrl(e.target.value)}
        fullWidth
        error={lyricsInvalid}
      />
      {lyricsInvalid && (
        <>
          <FormHelperText error>
            {httpUrlError(lyricsUrl) || 'Must be a valid http(s) URL'}
          </FormHelperText>
          {lyricsSuggestions.length > 0 && (
            <Stack direction="row" spacing={1}>
              {lyricsSuggestions.map((s) => (
                <Button key={s} size="small" variant="text" onClick={() => setLyricsUrl(s)}>
                  Use {s}
                </Button>
              ))}
            </Stack>
          )}
        </>
      )}

      <TextField
        label="YouTube URL"
        value={youtubeUrl}
        onChange={(e) => setYoutubeUrl(e.target.value)}
        fullWidth
        error={youtubeInvalid}
      />
      {youtubeInvalid && (
        <>
          <FormHelperText error>
            {httpUrlError(youtubeUrl) || 'Must be a valid http(s) URL'}
          </FormHelperText>
          {youtubeSuggestions.length > 0 && (
            <Stack direction="row" spacing={1}>
              {youtubeSuggestions.map((s) => (
                <Button key={s} size="small" variant="text" onClick={() => setYoutubeUrl(s)}>
                  Use {s}
                </Button>
              ))}
            </Stack>
          )}
        </>
      )}

      <Button
        variant="contained"
        onClick={submit}
        disabled={busy || formInvalid}
      >
        {busy ? 'Submitting...' : 'Propose'}
      </Button>
      {msg && (
        <Alert severity={msg === 'Submitted' ? 'success' : 'error'}>
          {msg}
        </Alert>
      )}
    </Stack>
  )
}
