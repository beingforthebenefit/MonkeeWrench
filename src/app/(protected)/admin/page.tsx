'use client'

import {useEffect, useState, useMemo} from 'react'
import {
  TextField,
  Button,
  Stack,
  Typography,
  Card,
  CardContent,
  Divider,
  Alert,
  FormHelperText,
} from '@mui/material'

// --- helpers ---------------------------------------------------------------

function splitAllowlist(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function urlLooksValid(url?: string): boolean {
  if (!url) return true // empty is allowed
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

// --- component -------------------------------------------------------------

export default function Admin() {
  // Settings state
  const [threshold, setThreshold] = useState<number>(2)
  const [allowlist, setAllowlist] = useState<string>('')
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsMsg, setSettingsMsg] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  // Quick-add Approved Song state
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('The Monkees')
  const [chartUrl, setChartUrl] = useState('')
  const [lyricsUrl, setLyricsUrl] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [adding, setAdding] = useState(false)
  const [addMsg, setAddMsg] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  // Derived URL warnings (non-blocking)
  const chartWarn = useMemo(
    () => !!chartUrl && !urlLooksValid(chartUrl),
    [chartUrl],
  )
  const lyricsWarn = useMemo(
    () => !!lyricsUrl && !urlLooksValid(lyricsUrl),
    [lyricsUrl],
  )
  const youtubeWarn = useMemo(
    () => !!youtubeUrl && !urlLooksValid(youtubeUrl),
    [youtubeUrl],
  )

  async function loadSettings() {
    setSettingsMsg(null)
    const res = await fetch('/api/settings', {cache: 'no-store'})
    if (!res.ok) {
      setSettingsMsg({
        type: 'error',
        text: `Failed to load settings (${res.status})`,
      })
      return
    }
    const j = await res.json()
    setThreshold(j.voteThreshold)
    setAllowlist((j.adminAllowlist || []).join(', '))
  }

  useEffect(() => {
    // first paint load
    loadSettings()
  }, [])

  async function saveSettings() {
    setSavingSettings(true)
    setSettingsMsg(null)
    try {
      const body = {
        voteThreshold: Number.isFinite(threshold) ? threshold : 0,
        adminAllowlist: splitAllowlist(allowlist),
      }
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `HTTP ${res.status}`)
      }
      setSettingsMsg({type: 'success', text: 'Settings saved.'})
      await loadSettings()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      setSettingsMsg({
        type: 'error',
        text: `Save failed: ${message}`,
      })
    } finally {
      setSavingSettings(false)
    }
  }

  async function addApprovedSong() {
    setAdding(true)
    setAddMsg(null)
    try {
      if (!title.trim()) throw new Error('Title is required.')
      if (!artist.trim()) throw new Error('Artist is required.')

      // POST to an admin-only endpoint that creates an APPROVED proposal immediately.
      // Implement this on the server to enforce admin and set status = 'APPROVED'.
      // Suggested route: POST /api/admin/proposals
      const res = await fetch('/api/admin/proposals', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          title: title.trim(),
          artist: artist.trim(),
          chartUrl: chartUrl.trim() || null,
          lyricsUrl: lyricsUrl.trim() || null,
          youtubeUrl: youtubeUrl.trim() || null,
          status: 'APPROVED', // server should ignore/force APPROVED anyway
        }),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `HTTP ${res.status}`)
      }

      setAddMsg({type: 'success', text: 'Approved song added to the setlist.'})
      // reset form (keep artist default)
      setTitle('')
      setArtist('The Monkees')
      setChartUrl('')
      setLyricsUrl('')
      setYoutubeUrl('')
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      setAddMsg({
        type: 'error',
        text: `Add failed: ${message}`,
      })
    } finally {
      setAdding(false)
    }
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h5">Admin</Typography>

      {/* Settings Card */}
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">Settings</Typography>
            {settingsMsg && (
              <Alert severity={settingsMsg.type}>{settingsMsg.text}</Alert>
            )}

            <TextField
              label="Vote Threshold"
              type="number"
              value={threshold}
              onChange={(e) =>
                setThreshold(parseInt(e.target.value || '0', 10))
              }
              inputProps={{min: 1}}
            />

            <TextField
              label="Admin Allowlist (emails, comma-separated)"
              value={allowlist}
              onChange={(e) => setAllowlist(e.target.value)}
              helperText="Only allow-listed Google accounts are admins."
            />

            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                onClick={saveSettings}
                disabled={savingSettings}
              >
                {savingSettings ? 'Saving...' : 'Save'}
              </Button>
              <Button
                variant="outlined"
                onClick={loadSettings}
                disabled={savingSettings}
              >
                Reload
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Divider flexItem />

      {/* Quick Add Approved Song */}
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">Add Approved Song</Typography>
            <Typography variant="body2" color="text.secondary">
              Creates a song directly in the Setlist (status = APPROVED). Use
              this to add known staples without the voting flow.
            </Typography>

            {addMsg && <Alert severity={addMsg.type}>{addMsg.text}</Alert>}

            <TextField
              label="Title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <TextField
              label="Artist"
              required
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              helperText='Defaults visually to "The Monkees".'
            />

            <TextField
              label="Chart URL"
              value={chartUrl}
              onChange={(e) => setChartUrl(e.target.value)}
              error={chartWarn}
            />
            {chartUrl && chartWarn && (
              <FormHelperText error>
                This doesn&apos;t look like a valid URL. Submission will still
                proceed.
              </FormHelperText>
            )}

            <TextField
              label="Lyrics URL"
              value={lyricsUrl}
              onChange={(e) => setLyricsUrl(e.target.value)}
              error={lyricsWarn}
            />
            {lyricsUrl && lyricsWarn && (
              <FormHelperText error>
                This doesn&apos;t look like a valid URL. Submission will still
                proceed.
              </FormHelperText>
            )}

            <TextField
              label="YouTube URL"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              error={youtubeWarn}
            />
            {youtubeUrl && youtubeWarn && (
              <FormHelperText error>
                This doesn&apos;t look like a valid URL. Submission will still
                proceed.
              </FormHelperText>
            )}

            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                onClick={addApprovedSong}
                disabled={adding}
              >
                {adding ? 'Adding...' : 'Add to Setlist'}
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  setTitle('')
                  setArtist('The Monkees')
                  setChartUrl('')
                  setLyricsUrl('')
                  setYoutubeUrl('')
                  setAddMsg(null)
                }}
                disabled={adding}
              >
                Reset
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  )
}
